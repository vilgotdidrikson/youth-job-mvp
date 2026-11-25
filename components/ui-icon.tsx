import type { SVGProps } from "react";

export type IconName = "camera" | "play" | "discover" | "map" | "activity" | "profile" | "filter" | "heart" | "close" | "info" | "bookmark" | "arrow" | "briefcase" | "check" | "chat" | "file" | "microphone" | "upload" | "edit" | "bell" | "eye" | "eye-off" | "chevron-left" | "plus" | "lock" | "bulb" | "cards" | "match" | "messages" | "store" | "instagram";
const paths: Record<IconName, React.ReactNode> = {
  camera: <><rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3Z"/></>,
  play: <path d="m9 5 10 7-10 7Z"/>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  "eye-off": <><path d="m3 3 18 18M10.6 5.1 12 5c6.5 0 10 7 10 7a21 21 0 0 1-3.1 4.1M6.2 6.2A20 20 0 0 0 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
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
  "chevron-left": <path d="m15 18-6-6 6-6"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>,
  bulb: <><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z"/></>,
  cards: <><rect x="8" y="3" width="12" height="15" rx="2.5"/><path d="M4.5 7.5V18a3 3 0 0 0 3 3h8"/></>,
  match: <><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/></>,
  messages: <><path d="M15 9a2 2 0 0 1-2 2H7l-4 3V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2Z"/><path d="M18 8h1a2 2 0 0 1 2 2v10l-3-3h-7a2 2 0 0 1-2-2v-1"/></>,
  store: <><path d="M3.5 4h17l-1 5.5h-15Z"/><path d="M5 9.5V20h14V9.5M10 20v-5h4v5"/></>,
  instagram: <><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/></>,
};

export function UiIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
