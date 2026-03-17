"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
} from "lucide-react";
import { ImageFile } from "@/lib/services/file-service";

interface LightboxProps {
  images: ImageFile[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

export function Lightbox({
  images,
  currentIndex,
  isOpen,
  onClose,
  onIndexChange,
}: LightboxProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const currentImage = images[currentIndex];

  const resetTransform = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  }, []);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      onIndexChange(currentIndex - 1);
      resetTransform();
    }
  }, [currentIndex, onIndexChange, resetTransform]);

  const goToNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      onIndexChange(currentIndex + 1);
      resetTransform();
    }
  }, [currentIndex, images.length, onIndexChange, resetTransform]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev * 1.5, 5));
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const newZoom = prev / 1.5;
      if (newZoom <= 1) {
        setPosition({ x: 0, y: 0 });
        return 1;
      }
      return newZoom;
    });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleBackgroundWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      // На фоне всегда переключаем изображения
      if (e.deltaY > 0) {
        goToNext();
      } else {
        goToPrevious();
      }
    },
    [goToNext, goToPrevious]
  );

  const handleImageWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // На изображении управляем зумом
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "a":
        case "ArrowLeft":
          goToPrevious();
          break;
        case "d":
        case "ArrowRight":
          goToNext();
          break;
        case "Escape":
          onClose();
          break;
        case "+":
        case "=":
          handleZoomIn();
          break;
        case "-":
          handleZoomOut();
          break;
        case "r":
          handleRotate();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, goToPrevious, goToNext, onClose]);

  if (!currentImage) return null;

  const imageUrl = `/api/image?path=${encodeURIComponent(
    currentImage.relativePath
  )}&size=original`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-none! w-screen! h-screen! max-h-none! p-0 border-0 rounded-none bg-black/60 backdrop-blur-lg"
        showCloseButton={false}
      >
        <VisuallyHidden>
          <DialogTitle>{currentImage.name}</DialogTitle>
          <DialogDescription>
            Image viewer - use arrow keys or scroll to navigate
          </DialogDescription>
        </VisuallyHidden>
        <div className="relative w-screen h-screen flex flex-col">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 ">
            <div className="text-white">
              <p className="text-sm font-medium truncate max-w-75">
                {currentImage.name}
              </p>
              <p className="text-xs text-white/70">
                {currentIndex + 1} / {images.length}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={handleZoomOut}
                title="Zoom out (-)"
              >
                <ZoomOut className="h-5 w-5" />
              </Button>
              <span className="text-white text-sm min-w-12.5 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={handleZoomIn}
                title="Zoom in (+)"
              >
                <ZoomIn className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={handleRotate}
                title="Rotate (R)"
              >
                <RotateCw className="h-5 w-5" />
              </Button>
              <a
                href={imageUrl}
                download={currentImage.name}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  title="Download"
                >
                  <Download className="h-5 w-5" />
                </Button>
              </a>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={onClose}
                title="Close (Esc)"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Image Container */}
          <div
            ref={containerRef}
            className="absolute inset-0 flex items-center justify-center overflow-hidden "
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleBackgroundWheel}
            onClick={(e) => {
              // Close on background click (not on image)
              if (e.target === e.currentTarget) {
                onClose();
              }
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={currentImage.name}
              className="max-w-full max-h-full object-contain select-none cursor-grab active:cursor-grabbing"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                transition: isDragging ? "none" : "transform 0.2s ease-out",
              }}
              draggable={false}
              onWheel={handleImageWheel}
            />
          </div>

          {/* Navigation Buttons */}
          {currentIndex > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
              onClick={goToPrevious}
              title="Previous (←)"
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
          )}
          {currentIndex < images.length - 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
              onClick={goToNext}
              title="Next (→)"
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
