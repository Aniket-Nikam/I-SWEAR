import type { MapInfo } from "../types/protocol";
export const MAPS: MapInfo[] = [
  { id: "campus", name: "Orpheus Campus", case_title: "The Blackout", subtitle: "An experiment. An outage. A case that moved.", theme: "campus", art: "/art/campus-night.svg", number: "01", rooms: 15 },
  { id: "observatory", name: "Meridian Observatory", case_title: "The Last Signal", subtitle: "One missing star plate. Two different skies.", theme: "observatory", art: "/art/observatory.svg", number: "02", rooms: 13 },
  { id: "ferry", name: "Saltwind Terminal", case_title: "The Night Crossing", subtitle: "The final ferry left. The manifest didn't.", theme: "ferry", art: "/art/ferry.svg", number: "03", rooms: 15 },
];
