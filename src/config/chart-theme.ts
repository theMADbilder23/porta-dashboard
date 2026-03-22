import type { ITheme } from "@visactor/vchart";

export const customDarkTheme: Partial<ITheme> = {
  type: "dark",
  background: "#020817",

  colorScheme: {
    default: [
      "#7C3AED", // primary purple
      "#A855F7", // bright purple
      "#C084FC", // soft purple
      "#E879F9", // pink accent
      "#F0ABFC", // light pink
    ],
  },
};

export const customLightTheme: Partial<ITheme> = {
  type: "light",

  colorScheme: {
    default: [
      "#6D28D9",
      "#8B5CF6",
      "#A78BFA",
      "#C084FC",
      "#E9D5FF",
    ],
  },
};