import { getAccessToken } from './auth';

export async function fetchSheetData(spreadsheetId: string, sheetName: string) {
    const token = await getAccessToken();
    const cleanId = encodeURIComponent(spreadsheetId);
    const res = await fetch(`/api/inventory/${cleanId}/${encodeURIComponent(sheetName)}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    
    const text = await res.text();
    if (!res.ok) {
        let errMsg = res.statusText;
        try {
            const errObj = JSON.parse(text);
            if (errObj.error) errMsg = errObj.error;
        } catch(e) {}
        throw new Error(errMsg);
    }
    
    if (text.startsWith("<!")) {
        throw new Error("Received HTML instead of JSON. Ensure the Spreadsheet ID is correct and doesn't contain a full URL.");
    }
    
    return JSON.parse(text);
}

export async function appendRow(spreadsheetId: string, sheetName: string, rowData: string[]) {
    const token = await getAccessToken();
    const cleanId = encodeURIComponent(spreadsheetId);
    const res = await fetch(`/api/inventory/${cleanId}/${encodeURIComponent(sheetName)}`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(rowData)
    });
    
    const text = await res.text();
    if (!res.ok) {
        let errMsg = res.statusText;
        try {
            const errObj = JSON.parse(text);
            if (errObj.error) errMsg = errObj.error;
        } catch(e) {}
        throw new Error(errMsg);
    }
    return JSON.parse(text);
}

export async function updateRow(spreadsheetId: string, sheetName: string, rowIndex: number, rowData: string[]) {
    const token = await getAccessToken();
    const cleanId = encodeURIComponent(spreadsheetId);
    const res = await fetch(`/api/inventory/${cleanId}/${encodeURIComponent(sheetName)}/${rowIndex}`, {
        method: "PUT",
        headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(rowData)
    });
    
    const text = await res.text();
    if (!res.ok) {
        let errMsg = res.statusText;
        try {
            const errObj = JSON.parse(text);
            if (errObj.error) errMsg = errObj.error;
        } catch(e) {}
        throw new Error(errMsg);
    }
    return JSON.parse(text);
}

export async function fetchConfig(spreadsheetId: string) {
    const token = await getAccessToken();
    const cleanId = encodeURIComponent(spreadsheetId);
    const res = await fetch(`/api/config/${cleanId}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    
    const text = await res.text();
    if (!res.ok) {
        let errMsg = res.statusText;
        try {
            const errObj = JSON.parse(text);
            if (errObj.error) errMsg = errObj.error;
        } catch(e) {}
        throw new Error(errMsg);
    }
    return JSON.parse(text);
}

export async function saveConfig(spreadsheetId: string, config: any) {
    const token = await getAccessToken();
    const cleanId = encodeURIComponent(spreadsheetId);
    const res = await fetch(`/api/config/${cleanId}`, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify(config)
    });
    
    const text = await res.text();
    if (!res.ok) {
        let errMsg = res.statusText;
        try {
            const errObj = JSON.parse(text);
            if (errObj.error) errMsg = errObj.error;
        } catch(e) {}
        throw new Error(errMsg);
    }
    return JSON.parse(text);
}

export async function deleteRow(spreadsheetId: string, sheetName: string, rowIndex: number) {
    const token = await getAccessToken();
    const cleanId = encodeURIComponent(spreadsheetId);
    const res = await fetch(`/api/inventory/${cleanId}/${encodeURIComponent(sheetName)}/${rowIndex}`, {
        method: "DELETE",
        headers: { 
            Authorization: `Bearer ${token}` 
        }
    });
    
    const text = await res.text();
    if (!res.ok) {
        let errMsg = res.statusText;
        try {
            const errObj = JSON.parse(text);
            if (errObj.error) errMsg = errObj.error;
        } catch(e) {}
        throw new Error(errMsg);
    }
    return JSON.parse(text);
}

