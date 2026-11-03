import type { CardMetadata } from "../models/collection";
// A loyalty ability costing more than the planeswalker's starting loyalty ("−7: …" on a 3-loyalty walker) isn't
// available when the card arrives. Shared by Card Intelligence tags and the card function.
const ULTIMATE = /^[−-](\d+):[^\n]*\n?/gm;
export function withoutInaccessibleUltimates(card: CardMetadata): { card: CardMetadata; dropped: boolean } {
  let dropped = false;
  const strip = (text: string | undefined, loyalty: string | undefined) => {
    const start = Number(loyalty);
    if (!text || !Number.isFinite(start)) return text;
    return text.replace(ULTIMATE, (line, cost: string) => (Number(cost) > start ? ((dropped = true), "") : line)).trimEnd();
  };
  const next = {
    ...card,
    oracleText: strip(card.oracleText, card.loyalty),
    cardFaces: card.cardFaces?.map((f) => ({ ...f, oracleText: strip(f.oracleText, f.loyalty ?? card.loyalty) })),
  };
  return dropped ? { card: next, dropped } : { card, dropped };
}
