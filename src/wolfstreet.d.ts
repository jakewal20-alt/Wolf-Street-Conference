// <wolfstreet-bar>, the shared Wolf Street suite bar (~/Developer/wolfstreet). Copied from Forecast.
// a present `signout` attribute shows the Sign out button, which fires `wolfstreet-signout`.
import type { DetailedHTMLProps, HTMLAttributes } from "react";

type WolfStreetBarProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  current?: "forecast" | "samklr" | "hallway";
  email?: string;
  note?: string;
  signout?: string;
  "forecast-url"?: string;
  "samklr-url"?: string;
  "hallway-url"?: string;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "wolfstreet-bar": WolfStreetBarProps;
    }
  }
}
