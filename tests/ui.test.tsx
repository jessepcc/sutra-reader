/**
 * High-level UI integration tests. These exercise React Router + the
 * SettingsProvider + the IndexedDB layer end-to-end through fake-indexeddb,
 * proving the UI bindings work — not just the pure logic.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "../src/ui/AppShell";
import { HomePage } from "../src/ui/HomePage";
import { BrowsePage } from "../src/ui/BrowsePage";
import { CanonPage } from "../src/ui/CanonPage";
import { VolumePage } from "../src/ui/VolumePage";
import { SavedPage } from "../src/ui/SavedPage";
import { BookmarksPage } from "../src/ui/BookmarksPage";
import { AboutPage } from "../src/ui/AboutPage";
import { SettingsPage } from "../src/ui/SettingsPage";
import { GatedNoticePage } from "../src/ui/GatedNoticePage";
import {
  _resetDbForTests,
  addBookmark,
  toggleSaved,
  recordRecent,
  getSettings,
} from "../src/lib/db";
import { _resetCatalogForTests } from "../src/lib/catalog-context";

function renderApp(initialEntries: string[] = ["/"]) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <AppShell />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "browse", element: <BrowsePage /> },
          { path: "browse/:canonId", element: <CanonPage /> },
          { path: "browse/:canonId/:volumeId", element: <VolumePage /> },
          { path: "saved", element: <SavedPage /> },
          { path: "bookmarks", element: <BookmarksPage /> },
          { path: "about", element: <AboutPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "gated/:canonId", element: <GatedNoticePage /> },
        ],
      },
    ],
    { initialEntries },
  );
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).indexedDB = new IDBFactory();
  _resetDbForTests();
  _resetCatalogForTests();
});

describe("HomePage", () => {
  it("renders the brand and the canon list from the lazy catalog index", async () => {
    renderApp();
    expect(screen.getByText("經閣", { selector: "h1" })).toBeInTheDocument();
    expect(await screen.findByText(/大正新脩大藏經/)).toBeInTheDocument();
    expect(screen.getByText(/續藏/)).toBeInTheDocument();
  });

  it("shows an empty-state when there are no recents", async () => {
    renderApp();
    expect(await screen.findByText("尚未開卷。")).toBeInTheDocument();
  });

  it("lists a recent after one is recorded", async () => {
    await recordRecent({ textId: "T48n2008", openedAt: Date.now() });
    renderApp();
    expect(await screen.findByText("六祖大師法寶壇經")).toBeInTheDocument();
  });
});

describe("Browse / Canon / Volume routes", () => {
  it("renders each level of the browse hierarchy", async () => {
    // BrowsePage lists the canon
    renderApp(["/browse"]);
    expect(
      await screen.findByRole("link", { name: /大正新脩大藏經/ }),
    ).toHaveAttribute("href", "/browse/T");

    // CanonPage lists volumes for the canon
    renderApp(["/browse/T"]);
    expect(
      await screen.findByRole("link", { name: /^T48/ }),
    ).toHaveAttribute("href", "/browse/T/T48");

    // VolumePage lists texts in the volume
    renderApp(["/browse/T/T48"]);
    expect(await screen.findByText("六祖大師法寶壇經")).toBeInTheDocument();
  });

  it("shows a not-found state for an unknown canon", async () => {
    renderApp(["/browse/Z"]);
    expect(await screen.findByText(/找不到此藏/)).toBeInTheDocument();
  });

  it("links gated canons to the notice route and the notice route renders", async () => {
    renderApp(["/browse"]);
    expect(
      await screen.findByRole("link", { name: /LC.*受授權限制/ }),
    ).toHaveAttribute("href", "/gated/LC");

    renderApp(["/gated/LC"]);
    expect(await screen.findByText(/非本 App 收錄/)).toBeInTheDocument();
  });
});

describe("SavedPage / BookmarksPage", () => {
  it("renders saved entries from IndexedDB", async () => {
    await toggleSaved("T48n2008");
    renderApp(["/saved"]);
    expect(await screen.findByText("六祖大師法寶壇經")).toBeInTheDocument();
  });

  it("renders bookmarks from IndexedDB", async () => {
    await addBookmark({ textId: "T48n2008", lb: "001a05", label: "壇經 卷首" });
    renderApp(["/bookmarks"]);
    const link = await screen.findByRole("link", { name: "壇經 卷首" });
    expect(link.getAttribute("href")).toBe("/read/T48n2008#lb_001a05");
  });

  it("shows empty states when nothing is stored", async () => {
    renderApp(["/saved"]);
    expect(await screen.findByText(/尚無收藏/)).toBeInTheDocument();
  });
});

describe("AboutPage", () => {
  it("displays the CBETA attribution string and license summary", () => {
    renderApp(["/about"]);
    expect(screen.getAllByText(/CBETA 中華電子佛典協會/).length).toBeGreaterThan(0);
    expect(screen.getByText(/MIT 授權/)).toBeInTheDocument();
    expect(screen.getAllByText(/CC BY-NC-SA 3.0 台灣/).length).toBeGreaterThan(0);
  });
});

describe("SettingsPage", () => {
  it("toggles paper mode and persists it to the DB", async () => {
    renderApp(["/settings"]);
    const inkButton = await screen.findByRole("button", { name: "墨" });
    await userEvent.click(inkButton);
    await waitFor(async () => {
      expect((await getSettings()).paperMode).toBe("ink");
    });
  });

  it("changes reading direction", async () => {
    renderApp(["/settings"]);
    const horizontal = await screen.findByRole("button", { name: /橫書/ });
    await userEvent.click(horizontal);
    await waitFor(async () => {
      expect((await getSettings()).direction).toBe("horizontal-lr");
    });
  });
});

describe("GatedNoticePage", () => {
  it("explains why the canon is excluded and links to cbeta.org", () => {
    renderApp(["/gated/LC"]);
    const main = screen.getByRole("main");
    const banner = within(main).getByRole("heading", { level: 1 });
    expect(banner).toHaveTextContent("LC");
    expect(within(main).getByRole("link", { name: /cbeta.org/i })).toBeInTheDocument();
  });
});
