export const CATEGORIES = ["grades", "sports", "dares", "custom"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  grades: "Grades",
  sports: "Sports",
  dares: "Dares",
  custom: "Custom",
};
