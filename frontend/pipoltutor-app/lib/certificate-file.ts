/** Client-safe URL helper. The backend checks the session cookie and ownership. */
export const certificateFileUrl = (id: string, format: "png" | "pdf", download = false) =>
  `/api/certificates/${id}/file?format=${format}${download ? "&download=1" : ""}`;
