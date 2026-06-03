const __routerMock = {
  replace: jest.fn(),
  push: jest.fn(),
  back: jest.fn(),
};

module.exports = {
  __routerMock,
  useRouter: () => __routerMock,
  useSegments: () => [],
  useRootNavigationState: () => ({ key: "test-key" }),
  Slot: "Slot",
  Link: "Link",
};
