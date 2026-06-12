import type { BundleFile } from "@/types/bundle";

export default function BundleFileTree({ files }: { files: BundleFile[] }) {
  return (
    <div className="filetree">
      {files.map((file) => (
        <div className="file-row" key={file.path ?? file.name}>
          <span className="file-dot" />
          <span>{file.path ?? file.name}</span>
          {file.kind && <em>{file.kind}</em>}
        </div>
      ))}
    </div>
  );
}
