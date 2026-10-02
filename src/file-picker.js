import { exec } from "node:child_process";
import fs from "node:fs";

/**
 * Abre a janela nativa do Explorador de Arquivos do Windows (OpenFileDialog)
 * para o usuário selecionar uma imagem no computador.
 */
export function openWindowsFilePicker(title = "Selecione uma imagem") {
  return new Promise((resolve) => {
    if (process.platform !== "win32") {
      return resolve(null);
    }

    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms
      $f = New-Object System.Windows.Forms.OpenFileDialog
      $f.Title = "${title}"
      $f.Filter = "Imagens (*.png;*.jpg;*.jpeg;*.webp;*.gif)|*.png;*.jpg;*.jpeg;*.webp;*.gif|Todos os Arquivos (*.*)|*.*"
      $f.InitialDirectory = [Environment]::GetFolderPath("MyPictures")
      if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        Write-Output $f.FileName
      }
    `.trim().replace(/\r?\n/g, "; ");

    const cmd = `powershell -NoProfile -STA -Command "${psScript}"`;

    exec(cmd, { timeout: 60000 }, (error, stdout) => {
      if (error || !stdout) {
        return resolve(null);
      }
      const selectedPath = stdout.trim();
      if (selectedPath && fs.existsSync(selectedPath)) {
        return resolve(selectedPath);
      }
      return resolve(null);
    });
  });
}
