// Deno type definitions are provided by deno.d.ts in the functions root

import { createClient } from 'supabase';
import { 
  corsHeaders, 
  handleError, 
  withAuth, 
  successResponse 
} from '../_shared/middleware.ts';
import { 
  CreateUserSchema, 
  UpdateUserSchema,
  DeleteUserSchema,
  validateRequest 
} from '../_shared/validation.ts';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Authentication & Authorization Middleware
    const { profile: requester } = await withAuth(req, ['ADMIN', 'LIBRARIAN']);

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop() || '';

    // 2. Routing (Controller Pattern)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Requires elevated permissions
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    /**
     * POST /create-user
     */
    if (req.method === 'POST' && (path === 'create-user' || path === '')) {
      const data = await validateRequest(req, CreateUserSchema);
      const { email, password, fullName, role } = data as any;

      // Governance check: Only Super Admin can create Admin/Librarian
      if (!requester.is_super_admin && (role === 'ADMIN' || role === 'LIBRARIAN')) {
        throw { message: 'Only Super Admin can create Admin or Librarian accounts', status: 403 };
      }

      // Create Auth User (Admin API)
      const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName }
      });

      if (authError) throw authError;

      // Update Profile (Sync)
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ 
          full_name: (data as any).fullName,
          role: (data as any).role
        })
        .eq('id', newUser.user.id);

      if (profileError) throw profileError;

      return successResponse({ 
        message: 'User created successfully', 
        user: { id: newUser.user.id, email: newUser.user.email } 
      }, 201);
    }

    /**
     * GET /list-users
     */
    if (req.method === 'GET' && path === 'list-users') {
      const { data: users, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return successResponse(users);
    }

    /**
     * PUT /update-user
     */
    if (req.method === 'PUT' && path === 'update-user') {
      const data = await validateRequest(req, UpdateUserSchema);
      const { id, fullName, role, isLocked } = data as any;
      
      // Fetch target profile for governance check
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('role, is_super_admin')
        .eq('id', id)
        .single();

      if (!targetProfile) throw { message: 'User not found', status: 404 };

      // Governance check: Cannot update Super Admin
      if (targetProfile.is_super_admin && requester.id !== id) {
        throw { message: 'Cannot modify Super Admin account', status: 403 };
      }

      // Hierarchy Enforcement:
      // 1. Only Super Admin can promote/demote to Admin/Librarian
      if (!requester.is_super_admin && role && role !== targetProfile.role && (role === 'ADMIN' || role === 'LIBRARIAN' || targetProfile.role === 'ADMIN' || targetProfile.role === 'LIBRARIAN')) {
        throw { message: 'Insufficient permissions to change administrative roles', status: 403 };
      }

      // 2. Librarian cannot manage Admin/Librarian
      if (requester.role === 'LIBRARIAN' && (targetProfile.role === 'ADMIN' || targetProfile.role === 'LIBRARIAN')) {
        throw { message: 'Librarians cannot manage other administrative accounts', status: 403 };
      }

      // 3. Admin cannot manage other Admins (except themselves maybe, but we prevent it for safety)
      if (requester.role === 'ADMIN' && targetProfile.role === 'ADMIN' && requester.id !== id) {
        throw { message: 'Admins cannot manage other Admin accounts', status: 403 };
      }

      const updatePayload: any = {};
      if (fullName !== undefined) updatePayload.full_name = fullName;
      if (role !== undefined) updatePayload.role = role;
      if (isLocked !== undefined) updatePayload.is_locked = isLocked;

      const { data: updatedProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (profileError) throw profileError;

      // Sync auth status if isLocked changed
      if (isLocked !== undefined) {
        if (isLocked) {
          await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: '876000h' }); // 100 years
        } else {
          await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: 'none' });
        }
      }

      return successResponse({ 
        message: 'User updated successfully',
        user: updatedProfile
      });
    }

    /**
     * DELETE /delete-user
     */
    if (req.method === 'DELETE' && path === 'delete-user') {
      let userId: string | null = null;
      
      // Try body first, then query params
      try {
        const body = await req.json();
        userId = body.userId || body.id;
      } catch {
        userId = url.searchParams.get('userId') || url.searchParams.get('id');
      }

      if (!userId) throw { message: 'User ID is required', status: 400 };

      // Fetch target profile for governance check
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('role, is_super_admin')
        .eq('id', userId)
        .single();

      if (!targetProfile) throw { message: 'User not found', status: 404 };

      // Governance check: Cannot delete Super Admin
      if (targetProfile.is_super_admin) {
        throw { message: 'Cannot delete Super Admin account', status: 403 };
      }

      // Governance check: Only Super Admin can delete other Admins or Librarians
      if (!requester.is_super_admin && (targetProfile.role === 'ADMIN' || targetProfile.role === 'LIBRARIAN')) {
        throw { message: 'Insufficient permissions to delete administrative accounts', status: 403 };
      }
      
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) {
        // If it's a foreign key error, give a better message
        if (error.message?.includes('foreign key constraint')) {
          throw { 
            message: 'Cannot delete user with active borrowing history or reviews. Lock the account instead.', 
            status: 400 
          };
        }
        throw error;
      }

      return successResponse({ message: 'User deleted successfully' });
    }

    throw { message: 'Route not found', status: 404 };

  } catch (err) {
    return handleError(err);
  }
});
