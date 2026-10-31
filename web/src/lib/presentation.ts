// Presentation mode: the clean judge view. Hides what repeats elsewhere (objective chips, room badges, map
// speech bubbles, move rows) and keeps the feed short. Toggle with P; start in it with ?mode=live&present.
import { createContext, useContext } from "react";

export const PresentationContext = createContext(false);

export const usePresentation = () => useContext(PresentationContext);

export const readPresentation = () => new URLSearchParams(location.search).has("present");
