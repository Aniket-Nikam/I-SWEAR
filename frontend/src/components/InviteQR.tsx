import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Dossier } from "./MysteryPanels";

export function InviteQR({ url, roomCode, onClose }: { url: string; roomCode: string; onClose: () => void }) {
  const [image, setImage] = useState("");
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, { width: 280, margin: 2, color: { dark: "#0b141c", light: "#d8d5c9" }, errorCorrectionLevel: "M" })
      .then((value) => { if (active) setImage(value); }).catch(() => { if (active) setImage(""); });
    return () => { active = false; };
  }, [url]);
  return <Dossier title="Bring another witness" subtitle="SCAN TO JOIN" onClose={onClose}><div className="invite-qr">{image && <img src={image} alt={`QR code to join room ${roomCode}`} />}<strong>{roomCode}</strong><p>{url}</p><small>On a local build, other devices must reach the same game server.</small></div></Dossier>;
}
