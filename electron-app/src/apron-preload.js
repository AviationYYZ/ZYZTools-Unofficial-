const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('preferredCyyzPdc',{apronTracks:()=>ipcRenderer.invoke('apron:tracks')});
