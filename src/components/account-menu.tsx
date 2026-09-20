"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { ChevronDown, LogOut, Settings2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials || "R";
}

export function AccountMenu() {
  const pathname = usePathname();
  const { openUserProfile, signOut } = useClerk();
  const { isLoaded: isUserLoaded, user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = `resulens-account-menu-${useId().replaceAll(":", "")}`;

  const displayName =
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    "Your account";
  const email = user?.primaryEmailAddress?.emailAddress ?? "Account active";
  const initials = getInitials(displayName);
  const isSettingsActive = pathname?.startsWith("/dashboard/settings") ?? false;

  useEffect(() => {
    if (!isOpen) return;

    const frame = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    });

    function closeFromOutside(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && !shellRef.current?.contains(target)) {
        setIsOpen(false);
      }
    }

    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  function closeMenu() {
    setIsOpen(false);
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!menuRef.current) return;

    const items = Array.from(menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    let nextIndex: number | null = null;

    if (event.key === "ArrowDown") {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
    } else if (event.key === "ArrowUp") {
      nextIndex =
        currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      items[nextIndex]?.focus();
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    setActionError(null);

    try {
      await signOut({ redirectUrl: "/" });
    } catch {
      setIsSigningOut(false);
      setActionError("Sign out did not complete. Try again.");
    }
  }

  return (
    <div className="account-menu-shell" ref={shellRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`account-trigger ${isSettingsActive ? "account-trigger-active" : ""}`}
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Open account menu"
        onClick={() => {
          setActionError(null);
          setIsOpen((open) => !open);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !isOpen) {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        <span className="account-avatar" aria-hidden="true">
          {user?.imageUrl ? (
            // Clerk hosts this image and supplies a safe, user-specific URL.
            // The empty alt keeps the decorative image out of the button name.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.imageUrl} alt="" />
          ) : (
            <span>{isUserLoaded ? initials : "…"}</span>
          )}
        </span>
        <span className="account-trigger-copy" aria-hidden="true">
          <span className="account-trigger-label">Account</span>
          <span className="account-trigger-name">{isUserLoaded ? displayName : "Loading"}</span>
        </span>
        <ChevronDown
          className="account-trigger-chevron"
          aria-hidden="true"
          size={15}
          strokeWidth={2.25}
        />
      </button>

      {isOpen && (
        <div
          className="account-menu"
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label="Account actions"
          onKeyDown={handleMenuKeyDown}
        >
          <div className="account-menu-profile">
            <span className="account-menu-avatar" aria-hidden="true">
              {user?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.imageUrl} alt="" />
              ) : (
                <span>{initials}</span>
              )}
            </span>
            <span className="account-menu-profile-copy">
              <strong>{displayName}</strong>
              <span>{email}</span>
            </span>
          </div>

          <div className="account-menu-list">
            <Link
              href="/dashboard/settings"
              className={`account-menu-item ${isSettingsActive ? "account-menu-item-active" : ""}`}
              role="menuitem"
              aria-current={isSettingsActive ? "page" : undefined}
              onClick={closeMenu}
            >
              <span className="account-menu-item-icon" aria-hidden="true">
                <Settings2 size={17} strokeWidth={2} />
              </span>
              <span>
                <strong>Settings</strong>
                <small>Privacy, retention, and deletion</small>
              </span>
            </Link>

            <button
              type="button"
              className="account-menu-item"
              role="menuitem"
              onClick={() => {
                closeMenu();
                openUserProfile();
              }}
            >
              <span className="account-menu-item-icon" aria-hidden="true">
                <ShieldCheck size={17} strokeWidth={2} />
              </span>
              <span>
                <strong>Account &amp; security</strong>
                <small>Manage sign-in methods with Clerk</small>
              </span>
            </button>
          </div>

          <div className="account-menu-divider" role="separator" />

          <button
            type="button"
            className="account-menu-item account-menu-item-danger"
            role="menuitem"
            disabled={isSigningOut}
            onClick={handleSignOut}
          >
            <span className="account-menu-item-icon" aria-hidden="true">
              <LogOut size={17} strokeWidth={2} />
            </span>
            <span>
              <strong>{isSigningOut ? "Signing out…" : "Sign out"}</strong>
              <small>End this Clerk session</small>
            </span>
          </button>

          {actionError && (
            <p className="account-menu-error" role="alert">
              {actionError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
