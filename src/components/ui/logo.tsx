import { BridgeIcon } from "./icons";

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-lg font-semibold tracking-tight">
      <span className="grid size-8 place-items-center rounded-control bg-primary text-on-primary">
        <BridgeIcon className="size-5" />
      </span>
      MedBridge
    </span>
  );
}
