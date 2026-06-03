-- Collaborative Annotation Table
CREATE TABLE IF NOT EXISTS public.annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_isbn TEXT NOT NULL REFERENCES public.books(isbn) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT,
    selection TEXT,
    location JSONB DEFAULT '{}',
    color TEXT DEFAULT '#FFFF00',
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view public annotations" ON public.annotations
    FOR SELECT USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "Users can create their own annotations" ON public.annotations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own annotations" ON public.annotations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own annotations" ON public.annotations
    FOR DELETE USING (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.annotations;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_annotations_book_isbn ON public.annotations(book_isbn);
CREATE INDEX IF NOT EXISTS idx_annotations_user_id ON public.annotations(user_id);
