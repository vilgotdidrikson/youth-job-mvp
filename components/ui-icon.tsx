import type { SVGProps } from "react";

export type IconName = "discover" | "map" | "activity" | "profile" | "filter" | "heart" | "close" | "info" | "bookmark" | "arrow" | "briefcase" | "check" | "chat" | "file" | "microphone" | "upload" | "edit";
const paths: Record<IconName, React.ReactNode> = {
  discover: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/><path d="M20 3v4M18 5h4"/></>,
  map: <><path d="m9 18-6 3V5l6-3 6 3 6-3v16l-6 3-6-3Z"/><path d="M9 2v16M15 5v16"/></>,
  activity: <><path d="m5 5-3 9v6h20v-6l-3-9Z"/><path d="M2 14h6l2 3h4l2-3h6"/></>,
  profile: <><circle cx="12" cy="7" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></>,
  filter: <><path d="M3 6h6m4 0h8M3 12h12m4 0h2M3 18h2m4 0h12M9 3v6m6 0v6M5 15v6"/></>,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></>,
  bookmark: <path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16l-6-4Z"/>,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  briefcase: <><rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a22 22 0 0 0 18 0M12 11v4"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></>,
  microphone: <><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></>,
  upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 16v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></>,
  edit: <><path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m13 6 5 5"/></>,
  chat: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>,
};

export function UiIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
