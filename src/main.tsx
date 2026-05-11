import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createBrowserRouter, Navigate } from "react-router-dom";
import "./styles/global.css";
import { AppShell } from "./ui/AppShell";
import { HomePage } from "./ui/HomePage";
import { BrowsePage } from "./ui/BrowsePage";
import { CanonPage } from "./ui/CanonPage";
import { VolumePage } from "./ui/VolumePage";
import { ReaderPage } from "./ui/ReaderPage";
import { SavedPage } from "./ui/SavedPage";
import { BookmarksPage } from "./ui/BookmarksPage";
import { AboutPage } from "./ui/AboutPage";
import { SettingsPage } from "./ui/SettingsPage";
import { GatedNoticePage } from "./ui/GatedNoticePage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "browse", element: <BrowsePage /> },
      { path: "browse/:canonId", element: <CanonPage /> },
      { path: "browse/:canonId/:volumeId", element: <VolumePage /> },
      { path: "read/:textId", element: <ReaderPage /> },
      { path: "saved", element: <SavedPage /> },
      { path: "bookmarks", element: <BookmarksPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "about", element: <AboutPage /> },
      { path: "gated/:canonId", element: <GatedNoticePage /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
