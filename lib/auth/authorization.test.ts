import { describe, expect, it } from "vitest";

import {
  type Actor,
  type WorkspaceAccessSubject,
  accessToWorkspace,
  canRead,
  canWrite,
  isGuest,
} from "./authorization";

const owner: Actor = {
  type: "user",
  id: "user-1",
  name: "Owner",
  email: "owner@example.com",
  image: null,
};

const otherUser: Actor = {
  type: "user",
  id: "user-2",
  name: "Someone Else",
  email: "other@example.com",
  image: null,
};

const guest: Actor = { type: "guest", id: "guest-1" };

const ownedWorkspace: WorkspaceAccessSubject = {
  id: "ws-1",
  ownerId: "user-1",
  isDemo: false,
};

const demoWorkspace: WorkspaceAccessSubject = {
  id: "ws-demo",
  ownerId: null,
  isDemo: true,
};

const orphanWorkspace: WorkspaceAccessSubject = {
  id: "ws-orphan",
  ownerId: null,
  isDemo: false,
};

describe("accessToWorkspace", () => {
  it("gives the owner write access", () => {
    expect(accessToWorkspace(owner, ownedWorkspace)).toBe("write");
  });

  it("denies a different signed-in user", () => {
    expect(accessToWorkspace(otherUser, ownedWorkspace)).toBe("none");
  });

  it("denies a guest on a private workspace", () => {
    expect(accessToWorkspace(guest, ownedWorkspace)).toBe("none");
  });

  it("denies a signed-out visitor on a private workspace", () => {
    expect(accessToWorkspace(null, ownedWorkspace)).toBe("none");
  });

  it("lets a guest read the demo workspace", () => {
    expect(accessToWorkspace(guest, demoWorkspace)).toBe("read");
  });

  it("denies an anonymous request even on the demo workspace", () => {
    // The demo requires a guest session rather than being world-readable. That
    // is what gives the guest cookie's signature something to protect: a forged
    // or expired token resolves to null and lands here.
    expect(accessToWorkspace(null, demoWorkspace)).toBe("none");
  });

  it("gives a signed-in user only read on the demo workspace", () => {
    // Shared seeded state: if any signed-in visitor could write to it, the next
    // person to open the demo would see whatever the last one did.
    expect(accessToWorkspace(owner, demoWorkspace)).toBe("read");
    expect(accessToWorkspace(otherUser, demoWorkspace)).toBe("read");
  });

  it("denies everyone on an owner-less non-demo workspace", () => {
    // Should not occur, but the rule must not fall through to allowing access
    // just because ownerId and actor id are both nullish.
    expect(accessToWorkspace(null, orphanWorkspace)).toBe("none");
    expect(accessToWorkspace(guest, orphanWorkspace)).toBe("none");
    expect(accessToWorkspace(otherUser, orphanWorkspace)).toBe("none");
  });
});

describe("canRead / canWrite", () => {
  it("treats write as implying read", () => {
    expect(canRead(owner, ownedWorkspace)).toBe(true);
    expect(canWrite(owner, ownedWorkspace)).toBe(true);
  });

  it("allows reading but not writing the demo", () => {
    expect(canRead(guest, demoWorkspace)).toBe(true);
    expect(canWrite(guest, demoWorkspace)).toBe(false);
    expect(canWrite(owner, demoWorkspace)).toBe(false);
  });

  it("denies an anonymous request everywhere", () => {
    expect(canRead(null, demoWorkspace)).toBe(false);
    expect(canRead(null, ownedWorkspace)).toBe(false);
  });

  it("denies both for an unauthorized actor", () => {
    expect(canRead(otherUser, ownedWorkspace)).toBe(false);
    expect(canWrite(otherUser, ownedWorkspace)).toBe(false);
  });
});

describe("isGuest", () => {
  it("narrows a guest actor", () => {
    expect(isGuest(guest)).toBe(true);
    expect(isGuest(owner)).toBe(false);
    expect(isGuest(null)).toBe(false);
  });
});
