import { Dialog, DialogContent, DialogTitle } from './ui/dialog'

interface ImageLightboxProps {
  src: string | null
  onClose: () => void
}

/** Full-screen image preview opened on double-click of an inline image.
 *  Closes on Esc, backdrop click, or the close button (Radix Dialog defaults). */
export function ImageLightbox({ src, onClose }: ImageLightboxProps) {
  const open = src !== null
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent
        data-testid="image-lightbox"
        className="flex max-h-[90vh] max-w-[90vw] items-center justify-center bg-transparent p-0 shadow-none border-none sm:max-w-[90vw]"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Image preview</DialogTitle>
        {src && (
          <img
            src={src}
            alt=""
            className="max-h-[90vh] max-w-[90vw] rounded-md object-contain"
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
