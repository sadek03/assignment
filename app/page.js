"use client";

import SignaturePad from "@/components/SignaturePad";
import { useState, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// Worker Setup
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

const FIELD_TYPES = [
  { id: "text", name: "Text", icon: "📝" },
  { id: "signature", name: "Signature", icon: "✍️" },
  { id: "date", name: "Date", icon: "📅" },
  { id: "checkbox", name: "Checkbox", icon: "☑️" },
  { id: "image", name: "Image", icon: "🖼️" },
];

export default function PDFEditor() {
  // --- STATE ---
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [scale, setScale] = useState(1.0);

  // Fields State
  const [fields, setFields] = useState([]);
  const [selectedFieldId, setSelectedFieldId] = useState(null);

  // Interaction State
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [draggedFieldType, setDraggedFieldType] = useState(null);
  const [isDraggingField, setIsDraggingField] = useState(null);

  const containerRef = useRef(null);

  // --- HANDLERS: PDF ---
  const handlePdfUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      setPdfUrl(URL.createObjectURL(file));
      setFields([]);
      setPageNumber(1);
    }
  };

  const changePage = (offset) => {
    setPageNumber((prevPageNumber) => {
      const newPage = prevPageNumber + offset;
      return Math.max(1, Math.min(newPage, numPages || 1));
    });
  };

  // --- HANDLERS: DRAG NEW FIELD ---
  const handleDragStart = (e, type) => {
    e.dataTransfer.setData("fieldType", type);
    setDraggedFieldType(type);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDraggedFieldType(null);

    const containerRect = containerRef.current.getBoundingClientRect();
    const typeId = e.dataTransfer.getData("fieldType");

    if (typeId) {
      const xPercent = (e.clientX - containerRect.left) / containerRect.width;
      const yPercent = (e.clientY - containerRect.top) / containerRect.height;

      const newField = {
        id: Date.now(),
        type: typeId,
        page: pageNumber, // Assign to current page
        xPercent,
        yPercent,
        width: 150,
        height: 40,
        value: "",
      };

      if (typeId === "checkbox") {
        newField.width = 30;
        newField.height = 30;
        newField.value = false;
      }
      if (typeId === "image") {
        newField.width = 100;
        newField.height = 100;
      }
      if (typeId === "signature") {
        newField.width = 120;
        newField.height = 60;
      }
      if (typeId === "date") {
        newField.value = new Date().toISOString().split("T")[0];
      }

      setFields([...fields, newField]);
      setSelectedFieldId(newField.id);
    }
  };

  const handleDragOver = (e) => e.preventDefault();

  // --- HANDLERS: MOVE FIELD ---
  const handleCanvasMouseDown = (e, fieldId) => {
    e.stopPropagation();
    setIsDraggingField(fieldId);
    setSelectedFieldId(fieldId);
  };

  const handleCanvasMouseMove = (e) => {
    if (!isDraggingField) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    let xPercent = (e.clientX - containerRect.left) / containerRect.width;
    let yPercent = (e.clientY - containerRect.top) / containerRect.height;

    xPercent = Math.max(0, Math.min(1, xPercent));
    yPercent = Math.max(0, Math.min(1, yPercent));

    setFields(
      fields.map((f) => {
        if (f.id === isDraggingField) {
          return { ...f, xPercent, yPercent };
        }
        return f;
      })
    );
  };

  const handleCanvasMouseUp = () => {
    setIsDraggingField(null);
  };

  const updateFieldValue = (id, value) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, value } : f)));
  };

  const deleteField = (id) => {
    setFields(fields.filter((f) => f.id !== id));
    setSelectedFieldId(null);
  };

  const handleSignatureSave = (dataUrl) => {
    if (selectedFieldId) {
      updateFieldValue(selectedFieldId, dataUrl);
      setShowSignaturePad(false);
    }
  };

  const openSignaturePad = (fieldId) => {
    setSelectedFieldId(fieldId);
    setShowSignaturePad(true);
  };

  const handleFinish = async () => {
    if (!pdfFile) return;

    const formData = new FormData();
    formData.append("pdf", pdfFile);
    formData.append("pdfId", "doc-" + Date.now());
    formData.append("fields", JSON.stringify(fields));

    try {
      const response = await fetch("http://localhost:5000/sign-pdf", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (result.success) {
        window.open(result.signedPdfUrl, "_blank");
        alert("Document Signed & Saved Successfully!");
      } else {
        alert("Error: " + result.error);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to connect to backend server.");
    }
  };

  return (
    <div
      className="h-screen w-screen bg-gray-100 flex flex-col font-sans text-gray-900 overflow-hidden"
      onMouseUp={handleCanvasMouseUp}
      onMouseMove={handleCanvasMouseMove}
    >
      <header className="bg-white shadow-sm z-20 px-6 py-3 flex justify-between items-center border-b border-gray-200 flex-none h-16">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <span className="text-2xl">📝</span> PDF Form Builder
        </h1>

        {pdfUrl && numPages && (
          <div className="flex items-center gap-3 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => changePage(-1)}
              disabled={pageNumber <= 1}
              className="px-3 py-1 bg-white hover:bg-gray-50 rounded shadow-sm text-sm font-medium disabled:opacity-50"
            >
              Prev
            </button>
            <span className="text-sm font-medium w-24 text-center">
              Page {pageNumber} of {numPages}
            </span>
            <button
              onClick={() => changePage(1)}
              disabled={pageNumber >= numPages}
              className="px-3 py-1 bg-white hover:bg-gray-50 rounded shadow-sm text-sm font-medium disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}

        <div className="flex items-center gap-4">
          <input
            type="file"
            accept="application/pdf"
            onChange={handlePdfUpload}
            className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          />
          {fields.length > 0 && (
            <button
              onClick={handleFinish}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium shadow transition-colors"
            >
              Finish & Save
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <aside className="w-64 bg-white border-r border-gray-200 p-6 flex-none overflow-y-auto z-10">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
            Toolkit
          </h3>
          <div className="space-y-3">
            {FIELD_TYPES.map((type) => (
              <div
                key={type.id}
                draggable
                onDragStart={(e) => handleDragStart(e, type.id)}
                className="flex items-center gap-3 p-4 bg-gray-50 hover:bg-white hover:shadow-md border border-gray-200 rounded-xl cursor-grab active:cursor-grabbing transition-all select-none"
              >
                <span className="text-xl">{type.icon}</span>
                <span className="font-medium text-gray-700">{type.name}</span>
              </div>
            ))}
          </div>
          <div className="mt-8 text-xs text-gray-400">
            <p>Drag items onto the PDF page.</p>
          </div>
        </aside>

        <main className="flex-1 bg-gray-200 overflow-auto relative flex justify-center p-8">
          {pdfUrl ? (
            <div
              ref={containerRef}
              className="relative shadow-xl bg-white transition-shadow"
              style={{ width: "fit-content", height: "fit-content" }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <Document
                file={pdfUrl}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                className="pointer-events-none"
              >
                <Page
                  key={`page_${pageNumber}`}
                  pageNumber={pageNumber}
                  scale={scale}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                  className="shadow-sm"
                />
              </Document>

              {fields
                .filter((field) => field.page === pageNumber)
                .map((field) => (
                  <RenderField
                    key={field.id}
                    field={field}
                    isSelected={selectedFieldId === field.id}
                    onMouseDown={(e) => handleCanvasMouseDown(e, field.id)}
                    onUpdate={updateFieldValue}
                    onDelete={() => deleteField(field.id)}
                    onEdit={() => {
                      if (field.type === "signature")
                        openSignaturePad(field.id);
                    }}
                  />
                ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-gray-400 h-full">
              <div className="w-24 h-24 bg-gray-300 rounded-full flex items-center justify-center mb-4">
                <span className="text-4xl">📄</span>
              </div>
              <p className="text-lg font-medium">
                Upload a PDF to start editing
              </p>
            </div>
          )}
        </main>
      </div>

      {showSignaturePad && (
        <SignaturePad
          onSave={handleSignatureSave}
          onCancel={() => setShowSignaturePad(false)}
        />
      )}
    </div>
  );
}

const RenderField = ({
  field,
  isSelected,
  onMouseDown,
  onUpdate,
  onDelete,
  onEdit,
}) => {
  const { type, value, xPercent, yPercent, width, height } = field;

  const style = {
    left: `${xPercent * 100}%`,
    top: `${yPercent * 100}%`,
    width: `${width}px`,
    height: `${height}px`,
    position: "absolute",
    transform: "translate(-50%, -50%)",
  };

  const commonClasses = `
    group flex items-center justify-center 
    border-2 transition-all cursor-move 
    ${
      isSelected
        ? "border-blue-600 bg-blue-50/10 shadow-lg z-50"
        : "border-transparent hover:border-blue-300 z-10"
    }
  `;

  const renderContent = () => {
    switch (type) {
      case "text":
        return (
          <textarea
            className="w-full h-full bg-transparent resize-none outline-none p-1 text-sm font-sans"
            placeholder="Type here..."
            value={value}
            onChange={(e) => onUpdate(field.id, e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
          />
        );

      case "date":
        return (
          <input
            type="date"
            className="w-full h-full bg-transparent outline-none text-xs p-1"
            value={value}
            onChange={(e) => onUpdate(field.id, e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
          />
        );

      case "checkbox":
        return (
          <input
            type="checkbox"
            className="w-5 h-5 cursor-pointer accent-blue-600"
            checked={value}
            onChange={(e) => onUpdate(field.id, e.target.checked)}
            onMouseDown={(e) => e.stopPropagation()}
          />
        );

      case "signature":
        return value ? (
          <img
            src={value}
            alt="Signature"
            className="w-full h-full object-contain pointer-events-none"
          />
        ) : (
          <button
            onClick={onEdit}
            className="w-full h-full bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100 flex items-center justify-center"
            onMouseDown={(e) => e.stopPropagation()}
          >
            Sign Here
          </button>
        );

      case "image":
        return value ? (
          <div className="relative w-full h-full group/img">
            <img src={value} className="w-full h-full object-cover" />
            <button
              onClick={() => onUpdate(field.id, "")}
              className="absolute top-0 right-0 bg-red-500 text-white text-xs p-1 hidden group-hover/img:block"
            >
              ✕
            </button>
          </div>
        ) : (
          <label className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-xs cursor-pointer hover:bg-gray-50">
            <span>📷 Upload</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    onUpdate(field.id, reader.result);
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
          </label>
        );

      default:
        return null;
    }
  };

  return (
    <div style={style} className={commonClasses} onMouseDown={onMouseDown}>
      {(isSelected || field.value) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute -top-3 -right-3 bg-white text-red-500 rounded-full w-6 h-6 flex items-center justify-center shadow border border-gray-200 hover:bg-red-50 text-xs z-50 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      )}
      <div className="w-full h-full relative">{renderContent()}</div>
    </div>
  );
};
