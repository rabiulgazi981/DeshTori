/** Hands a photo picked from the header camera button to /image-search (client-side navigation keeps module state). */
export const PENDING_IMAGE_EVENT = 'dt-pending-image';
let pending: File | null = null;
export const setPendingImage = (f: File | null) => {
  pending = f;
  // if /image-search is already open it won't remount, so tell it directly
  window.dispatchEvent(new Event(PENDING_IMAGE_EVENT));
};
export const takePendingImage = () => {
  const f = pending;
  pending = null;
  return f;
};
