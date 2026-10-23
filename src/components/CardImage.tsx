import { useState } from "react";
import { ImageOff } from "lucide-react";
import type { SampleCollectionCard } from "../models/card";
export function CardImage({
  card,
  detail = false,
  eager = false,
}: {
  card: SampleCollectionCard;
  detail?: boolean;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(!card.imageUrl);
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className={`card-image ${loaded ? "is-loaded" : ""} ${failed ? "image-failed" : ""}`}
    >
      {failed ? (
        <div
          className="image-fallback"
          role="img"
          aria-label={`${card.name} — artwork unavailable`}
        >
          <ImageOff size={28} />
          <strong>{card.name}</strong>
          <span>Artwork unavailable</span>
        </div>
      ) : (
        <img
          src={detail ? card.imageUrl : card.thumbnailUrl || card.imageUrl}
          alt={card.name}
          width="488"
          height="680"
          loading={detail || eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
