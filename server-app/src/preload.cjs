const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('servers',{action:(action,id,value)=>ipcRenderer.invoke('server:action',action,id,value)});
