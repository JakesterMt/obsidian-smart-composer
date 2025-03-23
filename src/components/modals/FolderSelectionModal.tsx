import { App, FuzzySuggestModal, TFolder } from 'obsidian';

/**
 * Modal for selecting a folder from the vault
 */
export class FolderSelectionModal extends FuzzySuggestModal<TFolder> {
  private folders: TFolder[] = [];
  private onSelect: (folder: TFolder) => void;
  private initialFolder: string;

  constructor(app: App, initialFolder: string, onSelect: (folder: TFolder) => void) {
    super(app);
    this.onSelect = onSelect;
    this.initialFolder = initialFolder;
    this.setPlaceholder("Select a folder for the new document");
    this.initializeFolders();
  }

  private initializeFolders() {
    // Get all folders in the vault
    this.folders = [];
    
    // Add root folder
    const rootFolder = this.app.vault.getRoot();
    this.folders.push(rootFolder);
    
    // Add all subfolders
    this.app.vault.getAllLoadedFiles().forEach(file => {
      if (file instanceof TFolder && file !== rootFolder) {
        this.folders.push(file);
      }
    });
    
    // Sort folders by path
    this.folders.sort((a, b) => a.path.localeCompare(b.path));
  }

  getItems(): TFolder[] {
    return this.folders;
  }

  getItemText(folder: TFolder): string {
    return folder.path === '' ? '/ (root)' : folder.path;
  }

  onChooseItem(folder: TFolder, evt: MouseEvent | KeyboardEvent): void {
    this.onSelect(folder);
  }

  /**
   * Opens the modal and returns a promise that resolves with the selected folder
   */
  openAndGetFolder(): Promise<TFolder> {
    return new Promise((resolve) => {
      this.onSelect = (folder: TFolder) => {
        resolve(folder);
      };
      this.open();
      
      // Try to select the initial folder if provided
      if (this.initialFolder) {
        const initialFolderObj = this.folders.find(f => f.path === this.initialFolder);
        if (initialFolderObj) {
          // Highlight the initial folder in the list
          const index = this.folders.indexOf(initialFolderObj);
          if (index >= 0) {
            setTimeout(() => {
              this.chooser?.setSelectedItem(index);
            }, 50);
          }
        }
      }
    });
  }
} 