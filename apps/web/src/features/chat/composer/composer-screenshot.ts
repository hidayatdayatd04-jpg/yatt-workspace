import { toast } from "sonner";

/** Tangkap layar via Screen Capture API → File PNG untuk lampiran chat. */
export async function captureScreenshot(onFile: (file: File) => void) {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    toast.error("Screenshot layar tidak didukung browser ini.");
    return;
  }
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const video = document.createElement("video");
    video.srcObject = stream;
    await video.play();
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("capture");
    onFile(new File([blob], `screenshot-${Date.now()}.png`, { type: "image/png" }));
    toast.success("Screenshot dilampirkan.");
  } catch (err) {
    if (err instanceof Error && (err.name === "NotAllowedError" || err.name === "AbortError")) return;
    toast.error("Gagal mengambil screenshot.");
  } finally {
    stream?.getTracks().forEach((t) => t.stop());
  }
}
