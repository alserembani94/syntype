/**
 * Share score: a dialog with the run as a square image, ready to share, copy
 * or download (src/lib/shareImage.ts draws it). Opened from the result screen
 * with the Share button or S, and loaded only then.
 *
 * X and Threads can't take an image through a link, so the image travels by
 * the system share sheet (where the browser can share files), the clipboard,
 * or a downloaded file.
 */
import { useEffect, useRef, useState } from 'react'
import { CopyIcon, DownloadIcon, Share2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/composites/use-toast'
import { renderShareImage, shareAlt, shareFileName, shareText, type ShareScore } from '../lib/shareImage'

interface Props {
  score: ShareScore
  onClose: () => void
  /** For the gallery: show this image instead of drawing one (null: still drawing). */
  image?: { blob: Blob; url: string } | null
}

const canShareFiles = (file: File) => typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
const canCopyImages = () => typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function'

export function ShareDialog({ score, onClose, image: given }: Props) {
  const toast = useToast()
  const [drawn, setDrawn] = useState<{ blob: Blob; url: string } | null>(null)
  const image = given === undefined ? drawn : given

  useEffect(() => {
    if (given !== undefined) return
    let live = true
    renderShareImage(score).then(
      (img) => live && setDrawn(img),
      (e: unknown) => live && toast.show(`Couldn’t make the image: ${e instanceof Error ? e.message : String(e)}`, { tone: 'error' }),
    )
    return () => {
      live = false
    }
  }, [score, given, toast])

  // The first action takes focus once there's an image to act on (it's disabled until then).
  const first = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (image) first.current?.focus()
  }, [image])

  const file = image ? new File([image.blob], shareFileName(score), { type: 'image/png' }) : null
  const shareable = file !== null && canShareFiles(file)

  const share = async () => {
    if (!file) return
    try {
      await navigator.share({ files: [file], text: shareText(score) })
    } catch (e) {
      // Closing the share sheet is a choice, not a failure.
      if (!(e instanceof DOMException && e.name === 'AbortError')) toast.show('Couldn’t open sharing here. Copy or download the image instead.', { tone: 'error' })
    }
  }
  const copy = async () => {
    if (!image) return
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': image.blob })])
      toast.show('Image copied. Paste it into your post.')
    } catch {
      toast.show('Couldn’t copy the image here. Download it instead.', { tone: 'error' })
    }
  }
  const download = () => {
    if (!image) return
    const url = URL.createObjectURL(image.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = shareFileName(score)
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.show(`Saved ${shareFileName(score)}.`)
  }

  return (
    <Dialog isOpen onOpenChange={(open) => !open && onClose()} className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Share your score</DialogTitle>
        <DialogDescription>A square image for X, Threads or anywhere else, in your theme&rsquo;s colours. It&rsquo;s made on your device.</DialogDescription>
      </DialogHeader>
      <div className="aspect-square w-full overflow-hidden rounded-lg ring-1 ring-foreground/10">
        {image ? <img src={image.url} alt={shareAlt(score)} className="block size-full" /> : <Skeleton className="size-full" aria-label="Making the image…" role="img" />}
      </div>
      <DialogFooter className="sm:justify-center">
        {shareable && (
          <Button ref={first} onPress={share}>
            <Share2Icon />
            Share
          </Button>
        )}
        {canCopyImages() && (
          <Button ref={shareable ? undefined : first} variant={shareable ? 'outline' : 'default'} onPress={copy} isDisabled={!image}>
            <CopyIcon />
            Copy image
          </Button>
        )}
        <Button ref={shareable || canCopyImages() ? undefined : first} variant="outline" onPress={download} isDisabled={!image}>
          <DownloadIcon />
          Download
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
