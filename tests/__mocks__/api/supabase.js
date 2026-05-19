const createQueryBuilder = () => {
  const resolved = Promise.resolve({ data: [], error: null });
  const builder = {
    select: jest.fn(() => builder),
    insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
    update: jest.fn(() => Promise.resolve({ data: null, error: null })),
    delete: jest.fn(() => Promise.resolve({ data: null, error: null })),
    eq: jest.fn(() => builder),
    neq: jest.fn(() => builder),
    gt: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lt: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    like: jest.fn(() => builder),
    ilike: jest.fn(() => builder),
    is: jest.fn(() => builder),
    in: jest.fn(() => builder),
    not: jest.fn(() => builder),
    filter: jest.fn(() => builder),
    or: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    single: jest.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: jest.fn(() => builder),
    range: jest.fn(() => builder),
    contains: jest.fn(() => builder),
    textSearch: jest.fn(() => builder),
  };

  // Allow `await supabase.from(...).select('*')` in tests.
  builder.then = resolved.then.bind(resolved);
  builder.catch = resolved.catch.bind(resolved);
  builder.finally = resolved.finally.bind(resolved);

  return builder;
};

module.exports = {
  supabase: {
    from: jest.fn(() => createQueryBuilder()),
    rpc: jest.fn(() =>
      Promise.resolve({ data: { success: true }, error: null }),
    ),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
      unsubscribe: jest.fn().mockReturnThis(),
    })),
    removeChannel: jest.fn().mockResolvedValue(null),
    auth: {
      signInWithPassword: jest.fn(() =>
        Promise.resolve({ data: { session: null }, error: null }),
      ),
      signInWithOAuth: jest.fn(() =>
        Promise.resolve({
          data: { url: "https://example.com/oauth" },
          error: null,
        }),
      ),
      signUp: jest.fn(() =>
        Promise.resolve({ data: { session: null, user: null }, error: null }),
      ),
      signOut: jest.fn(() => Promise.resolve({ error: null })),
      getSession: jest.fn(() =>
        Promise.resolve({ data: { session: null }, error: null }),
      ),
    },
  },
};
