export function AiVisual() {
  return (
    <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="platform-visual-svg">
      <defs>
        <linearGradient id="ai-grad" x1="60" y1="60" x2="340" y2="340" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f7c2ce" />
          <stop offset="1" stopColor="#dc6f8d" />
        </linearGradient>
        <radialGradient id="ai-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(200 190) rotate(90) scale(150)">
          <stop stopColor="#ec7598" stopOpacity=".55" />
          <stop offset="1" stopColor="#ec7598" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="190" r="150" fill="url(#ai-glow)" />
      <g stroke="url(#ai-grad)" strokeWidth="1.4" strokeOpacity=".55">
        <path d="M200 90 L120 150" />
        <path d="M200 90 L280 150" />
        <path d="M200 90 L200 60" />
        <path d="M120 150 L120 240" />
        <path d="M280 150 L280 240" />
        <path d="M120 150 L200 190" />
        <path d="M280 150 L200 190" />
        <path d="M120 240 L200 190" />
        <path d="M280 240 L200 190" />
        <path d="M120 240 L200 290" />
        <path d="M280 240 L200 290" />
        <path d="M200 190 L200 290" />
      </g>
      <g fill="url(#ai-grad)">
        <circle cx="200" cy="60" r="5" />
        <circle cx="120" cy="150" r="6" />
        <circle cx="280" cy="150" r="6" />
        <circle cx="120" cy="240" r="6" />
        <circle cx="280" cy="240" r="6" />
        <circle cx="200" cy="290" r="6" />
      </g>
      <circle cx="200" cy="190" r="26" fill="#0d0b10" stroke="url(#ai-grad)" strokeWidth="2" />
      <path
        d="M200 176 L205.5 186.5 L217 190 L205.5 193.5 L200 204 L194.5 193.5 L183 190 L194.5 186.5 Z"
        fill="url(#ai-grad)"
      />
      <path d="M150 110 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4Z" fill="url(#ai-grad)" opacity=".85" />
      <path d="M262 260 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3Z" fill="url(#ai-grad)" opacity=".7" />
    </svg>
  );
}

export function MatchVisual() {
  return (
    <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="platform-visual-svg">
      <defs>
        <linearGradient id="match-grad" x1="60" y1="80" x2="340" y2="320" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f7c2ce" />
          <stop offset="1" stopColor="#dc6f8d" />
        </linearGradient>
      </defs>
      <rect x="70" y="90" width="140" height="190" rx="20" fill="#141018" stroke="url(#match-grad)" strokeOpacity=".5" strokeWidth="1.5" transform="rotate(-8 140 185)" />
      <rect x="190" y="120" width="140" height="190" rx="20" fill="#181219" stroke="url(#match-grad)" strokeOpacity=".8" strokeWidth="1.5" transform="rotate(6 260 215)" />
      <g transform="rotate(-8 140 185)">
        <circle cx="140" cy="150" r="26" fill="url(#match-grad)" opacity=".35" />
        <rect x="105" y="195" width="70" height="10" rx="5" fill="#ffffff" opacity=".18" />
        <rect x="105" y="215" width="50" height="8" rx="4" fill="#ffffff" opacity=".12" />
      </g>
      <g transform="rotate(6 260 215)">
        <circle cx="260" cy="180" r="26" fill="url(#match-grad)" opacity=".5" />
        <rect x="225" y="225" width="70" height="10" rx="5" fill="#ffffff" opacity=".22" />
        <rect x="225" y="245" width="50" height="8" rx="4" fill="#ffffff" opacity=".14" />
      </g>
      <circle cx="200" cy="190" r="34" fill="#0d0b10" stroke="url(#match-grad)" strokeWidth="2" />
      <path
        d="M200 205c-11-7.3-18-13.6-18-21.7 0-6.2 4.9-11 11-11 3.5 0 6.9 1.7 9 4.4a11.9 11.9 0 0 1 9-4.4c6.1 0 11 4.8 11 11 0 8.1-7 14.4-18 21.7z"
        fill="url(#match-grad)"
      />
    </svg>
  );
}

export function ChatVisual() {
  return (
    <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="platform-visual-svg">
      <defs>
        <linearGradient id="chat-grad" x1="70" y1="90" x2="330" y2="310" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f7c2ce" />
          <stop offset="1" stopColor="#dc6f8d" />
        </linearGradient>
      </defs>
      <rect x="70" y="110" width="200" height="120" rx="24" fill="#141018" stroke="url(#chat-grad)" strokeOpacity=".6" strokeWidth="1.5" />
      <path d="M110 230 L110 262 L146 230 Z" fill="#141018" stroke="url(#chat-grad)" strokeOpacity=".6" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="98" y="140" width="120" height="10" rx="5" fill="#ffffff" opacity=".18" />
      <rect x="98" y="162" width="90" height="10" rx="5" fill="#ffffff" opacity=".14" />
      <rect x="98" y="184" width="60" height="10" rx="5" fill="#ffffff" opacity=".1" />
      <rect x="150" y="185" width="180" height="110" rx="24" fill="url(#chat-grad)" opacity=".92" />
      <path d="M310 295 L310 325 L276 295 Z" fill="url(#chat-grad)" opacity=".92" />
      <rect x="176" y="212" width="130" height="10" rx="5" fill="#1a1015" opacity=".55" />
      <rect x="176" y="234" width="100" height="10" rx="5" fill="#1a1015" opacity=".4" />
      <rect x="176" y="256" width="70" height="10" rx="5" fill="#1a1015" opacity=".3" />
    </svg>
  );
}

export function MapVisual() {
  return (
    <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="platform-visual-svg">
      <defs>
        <linearGradient id="map-grad" x1="60" y1="80" x2="340" y2="320" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f7c2ce" />
          <stop offset="1" stopColor="#dc6f8d" />
        </linearGradient>
      </defs>
      <rect x="60" y="70" width="280" height="240" rx="22" fill="#141018" stroke="url(#map-grad)" strokeOpacity=".4" strokeWidth="1.5" />
      <g stroke="#ffffff" strokeOpacity=".08">
        <path d="M60 130 H340" /><path d="M60 190 H340" /><path d="M60 250 H340" />
        <path d="M140 70 V310" /><path d="M220 70 V310" /><path d="M300 70 V310" />
      </g>
      <g>
        <path d="M148 150c0-14 11-25 25-25s25 11 25 25c0 18-25 42-25 42s-25-24-25-42Z" fill="url(#map-grad)" opacity=".45" />
        <circle cx="173" cy="150" r="9" fill="#0d0b10" />
      </g>
      <g>
        <path d="M244 200c0-15.5 12.5-28 28-28s28 12.5 28 28c0 20-28 47-28 47s-28-27-28-47Z" fill="url(#map-grad)" />
        <circle cx="272" cy="200" r="10" fill="#0d0b10" />
      </g>
      <g>
        <path d="M90 220c0-11 9-20 20-20s20 9 20 20c0 14.5-20 34-20 34s-20-19.5-20-34Z" fill="url(#map-grad)" opacity=".65" />
        <circle cx="110" cy="220" r="7.5" fill="#0d0b10" />
      </g>
    </svg>
  );
}

export function EverywhereVisual() {
  return (
    <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="platform-visual-svg">
      <defs>
        <linearGradient id="ew-grad" x1="60" y1="90" x2="330" y2="310" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f7c2ce" />
          <stop offset="1" stopColor="#dc6f8d" />
        </linearGradient>
      </defs>
      <rect x="90" y="90" width="180" height="120" rx="10" fill="#141018" stroke="url(#ew-grad)" strokeOpacity=".55" strokeWidth="1.5" />
      <rect x="102" y="102" width="156" height="90" rx="3" fill="#ffffff" opacity=".05" />
      <rect x="150" y="216" width="60" height="8" rx="4" fill="url(#ew-grad)" opacity=".7" />
      <rect x="235" y="150" width="80" height="150" rx="16" fill="#181219" stroke="url(#ew-grad)" strokeWidth="1.5" />
      <rect x="245" y="168" width="60" height="108" rx="4" fill="#ffffff" opacity=".06" />
      <circle cx="275" cy="286" r="4" fill="url(#ew-grad)" />
      <g opacity=".8">
        <rect x="112" y="122" width="60" height="8" rx="4" fill="#ffffff" opacity=".15" />
        <rect x="112" y="140" width="90" height="8" rx="4" fill="#ffffff" opacity=".12" />
        <rect x="112" y="158" width="40" height="8" rx="4" fill="#ffffff" opacity=".1" />
      </g>
      <g opacity=".85">
        <rect x="253" y="188" width="44" height="30" rx="6" fill="url(#ew-grad)" opacity=".4" />
        <rect x="253" y="226" width="44" height="8" rx="4" fill="#ffffff" opacity=".15" />
        <rect x="253" y="242" width="30" height="8" rx="4" fill="#ffffff" opacity=".1" />
      </g>
    </svg>
  );
}
