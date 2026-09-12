import React, { forwardRef } from "react";
import { createCustomIcon, type IconProps } from "./base";

function createBrandIcon(name: string, src: string, alt: string) {
  const Component = forwardRef<HTMLImageElement, IconProps & { alt?: string }>(
    ({ size, className, style, alt: customAlt, ...props }, ref) => (
      <img
        ref={ref}
        src={src}
        alt={customAlt || alt}
        width={size}
        height={size}
        className={className || "size-4 object-contain"}
        style={style}
        loading="lazy"
        decoding="async"
        aria-hidden="true"
        {...(props as React.ImgHTMLAttributes<HTMLImageElement>)}
      />
    )
  );
  Component.displayName = name;
  return Component;
}

export const GmailIcon = createBrandIcon("GmailIcon", "/icons/gmail.svg", "Gmail");
export const GoogleDriveIcon = createBrandIcon("GoogleDriveIcon", "/icons/google-drive.svg", "Google Drive");
export const GoogleCalendarIcon = createBrandIcon("GoogleCalendarIcon", "/icons/google-calendar.svg", "Google Calendar");
export const GoogleDocsIcon = createBrandIcon("GoogleDocsIcon", "/icons/google-docs.svg", "Google Docs");
export const GoogleSheetsIcon = createBrandIcon("GoogleSheetsIcon", "/icons/google-sheets.svg", "Google Sheets");
export const GoogleSlidesIcon = createBrandIcon("GoogleSlidesIcon", "/icons/google-slides.svg", "Google Slides");
export const MikrotikIcon = createBrandIcon("MikrotikIcon", "/icons/mikrotik.svg", "MikroTik Server");

export const Folder = createCustomIcon("Folder", <path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />);
export const Mail = createCustomIcon("Mail", <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>);
export const ArrowRight = createCustomIcon("ArrowRight", <path d="M4 12h16m-6-6 6 6-6 6" />);
export const Calendar = createCustomIcon("Calendar", <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4m8-4v4M3 10h18" /></>);
export const GoogleG = createCustomIcon("GoogleG", <><path d="M12 11v3.5h5.2c-.25 1.6-1.85 4.7-5.2 4.7a5.9 5.9 0 0 1 0-11.8c1.5 0 2.5.65 3.1 1.2l2.1-2A8.7 8.7 0 0 0 12 4.5a8.5 8.5 0 0 0 0 17c4.9 0 8.2-3.45 8.2-8.3 0-.55-.05-.95-.15-1.35H12Z" /></>);

