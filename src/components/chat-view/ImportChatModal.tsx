import { App, FuzzySuggestModal, TFile } from 'obsidian'
import React from 'react'

export interface ImportChatModalProps {
  app: App
  folderPath: string
  onSelect: (file: TFile) => void
}

export class ImportChatModal extends FuzzySuggestModal<TFile> {
  private folderPath: string
  private onSelect: (file: TFile) => void

  constructor(app: App, folderPath: string, onSelect: (file: TFile) => void) {
    super(app)
    this.folderPath = folderPath
    this.onSelect = onSelect
    this.setPlaceholder('Select a chat file to import')
  }

  getItems(): TFile[] {
    // Get all markdown files in the specified folder
    const files = this.app.vault.getMarkdownFiles()
    return files.filter(file => {
      // Check if the file is in the specified folder
      return file.path.startsWith(this.folderPath)
    })
  }

  getItemText(file: TFile): string {
    // Remove the folder path and .md extension for display
    return file.basename
  }

  onChooseItem(file: TFile, evt: MouseEvent | KeyboardEvent): void {
    this.onSelect(file)
  }
} 