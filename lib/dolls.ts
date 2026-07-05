import dollsData from "@/data/dolls.json";

export type Doll = {
  id: string;
  name: string;
  price: number;
  image: string;
  productUrl: string;
  personality: string[];
  matchKeywords: string[];
  staticStory: string;
};

export const dolls: Doll[] = dollsData;

export function getDoll(id: string): Doll | undefined {
  return dolls.find((d) => d.id === id);
}

export const dollIds = dolls.map((d) => d.id);
