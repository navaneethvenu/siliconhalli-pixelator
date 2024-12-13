"use client";

import React, { useState, useRef, useEffect, ChangeEvent } from "react";
import {
  Upload,
  Download,
  Trash2,
  Plus,
  RefreshCcw,
  Clipboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

const defaultColors: string[] = [
  "#F53636",
  "#D59C15",
  "#A97F89",
  "#3B6272",
  "#40B3CE",
  "#314353",
  "#FAC0BD",
  "#68525E",
  "#88785E",
  "#FEE5B0",
  "#E4E4DB",
  "#EEECD3",
  "#75A0AA",
  "#FFFFFF",
];

export const isBrowser = (): boolean => {
  return typeof window !== "undefined";
};

export const nextLocalStorage = (): Storage | void => {
  if (isBrowser()) {
    return window.localStorage;
  }
};
const PixelArtGenerator: React.FC = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [pixelSize, setPixelSize] = useState<number>(10);
  const [artboardWidth, setArtboardWidth] = useState<number>(400);
  const [artboardHeight, setArtboardHeight] = useState<number>(400);
  const [colorMode, setColorMode] = useState<boolean>(false);
  const [colors, setColors] = useState<string[]>(() => {
    const storedColors = nextLocalStorage()?.getItem("colors");
    return storedColors ? JSON.parse(storedColors) : [...defaultColors];
  });

  const [weights, setWeights] = useState<{ [color: string]: number }>(() => {
    const storedWeights = nextLocalStorage()?.getItem("colorWeights");
    return storedWeights ? JSON.parse(storedWeights) : {};
  });

  // NEW: Color weights state
  const [colorWeights, setColorWeights] = useState<{ [color: string]: number }>(
    () => {
      if (Object.keys(weights).length > 0) {
        return weights; // Use stored weights if available
      }

      // Default behavior if no storedWeights found
      const newWeights: { [color: string]: number } = {};
      defaultColors.forEach((color) => (newWeights[color] = 1)); // Default weight is 1 for all colors
      return newWeights;
    }
  ); // For toggleable accordion

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const drawPixelArt = () => {
      const canvas = canvasRef.current;
      const previewCanvas = previewCanvasRef.current;

      if (!canvas || !previewCanvas || !image) return;

      const ctx = canvas.getContext("2d");
      const previewCtx = previewCanvas.getContext("2d");

      if (!ctx || !previewCtx) return;

      // Set dimensions for both canvases
      canvas.width = artboardWidth;
      canvas.height = artboardHeight;
      previewCanvas.width = artboardWidth;
      previewCanvas.height = artboardHeight;

      // Clear both canvases
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

      // Draw original image on preview canvas
      const scale = Math.min(
        artboardWidth / image.width,
        artboardHeight / image.height
      );
      const x = (artboardWidth - image.width * scale) / 2;
      const y = (artboardHeight - image.height * scale) / 2;
      previewCtx.drawImage(
        image,
        x,
        y,
        image.width * scale,
        image.height * scale
      );

      // Create pixelated version on main canvas
      ctx.imageSmoothingEnabled = false;
      const scaledWidth =
        pixelSize != 0 ? Math.floor(artboardWidth / pixelSize) : artboardWidth;
      const scaledHeight =
        pixelSize != 0
          ? Math.floor(artboardHeight / pixelSize)
          : artboardHeight;

      // Use an offscreen canvas for the intermediate step
      const offscreenCanvas = document.createElement("canvas");
      offscreenCanvas.width = scaledWidth;
      offscreenCanvas.height = scaledHeight;
      const offscreenCtx = offscreenCanvas.getContext("2d");

      // Draw scaled down version to offscreen canvas
      offscreenCtx?.drawImage(previewCanvas, 0, 0, scaledWidth, scaledHeight);

      // Draw from offscreen canvas back to main canvas, scaled up
      ctx.drawImage(
        offscreenCanvas,
        0,
        0,
        scaledWidth,
        scaledHeight,
        0,
        0,
        artboardWidth,
        artboardHeight
      );

      // Apply color mode and color swaps if necessary
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (colorMode) {
        for (let i = 0; i < imageData.data.length; i += 4) {
          const closestColor = findClosestWeightedColor(
            imageData.data[i],
            imageData.data[i + 1],
            imageData.data[i + 2]
          );
          const [r, g, b] = hexToRgb(closestColor);
          imageData.data[i] = r;
          imageData.data[i + 1] = g;
          imageData.data[i + 2] = b;
        }
      }

      ctx.putImageData(imageData, 0, 0);
    };

    // NEW: Adjust color selection based on weights
    const findClosestWeightedColor = (
      r: number,
      g: number,
      b: number
    ): string => {
      return colors.reduce(
        (closest, color) => {
          const [cr, cg, cb] = hexToRgb(color);
          const distance = Math.sqrt(
            (cr - r) ** 2 + (cg - g) ** 2 + (cb - b) ** 2
          );
          const weight = colorWeights[color] || 1; // Use weight
          const adjustedDistance = distance / weight; // Adjust distance by weight
          return adjustedDistance < closest.adjustedDistance
            ? { color, adjustedDistance }
            : closest;
        },
        { color: colors[0], adjustedDistance: Infinity }
      ).color;
    };

    if (image) {
      drawPixelArt();
    }
  }, [
    image,
    pixelSize,
    artboardWidth,
    artboardHeight,
    colorMode,
    colors,
    colorWeights,
  ]);

  useEffect(() => {
    nextLocalStorage()?.setItem("colors", JSON.stringify(colors));
    nextLocalStorage()?.setItem("colorWeights", JSON.stringify(colorWeights));
  }, [colors, colorWeights]);

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setImage(img);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const hexToRgb = (hex: string): [number, number, number] => {
    const bigint = parseInt(hex.slice(1), 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
  };

  const rgbToHex = (r: number, g: number, b: number): string => {
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  };

  const handleColorWeightChange = (color: string, weight: number) => {
    setColorWeights((prevWeights) => ({
      ...prevWeights,
      [color]: weight,
    }));
    setWeights((prevWeights) => ({
      ...prevWeights,
      [color]: weight,
    }));
  };

  const exportImage = (format: "png" | "gif") => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL(`image/${format}`);
    const link = document.createElement("a");
    link.download = `pixel-art.${format}`;
    link.href = dataUrl;
    link.click();
  };

  // Function to create an SVG from the pixel data on the canvas
  const createSvgFromCanvas = () => {
    const finalPixelSize = pixelSize != 0 ? pixelSize : 1;
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);

    // Start SVG string with appropriate dimensions
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">`;

    for (let y = 0; y < height; y += finalPixelSize) {
      for (let x = 0; x < width; x += finalPixelSize) {
        const index = (y * width + x) * 4;
        const r = imageData.data[index];
        const g = imageData.data[index + 1];
        const b = imageData.data[index + 2];
        const a = imageData.data[index + 3]; // Alpha value

        // Skip creating <rect> if the pixel is transparent
        if (a === 0) continue;

        const hexColor = colorMode
          ? findNearestColor(r, g, b, colors)
          : rgbToHex(r, g, b);

        // Add each "pixel" as an SVG <rect> element
        svg += `<rect x="${x}" y="${y}" width="${finalPixelSize}" height="${finalPixelSize}" fill="${hexColor}" />`;
      }
    }

    // Close the SVG tag
    svg += `</svg>`;

    console.log(svg);

    return svg;
  };

  // Convert the SVG string into a Blob and copy to clipboard as SVG
  // const copySvgToClipboard = async () => {
  //   alert("hello");
  //   const svgString = createSvgFromCanvas();
  //   if (!svgString) return;

  //   try {
  //     // 1. Create a Blob from the SVG string
  //     const svgBlob = new Blob([svgString], { type: "image/svg+xml" });

  //     // 2. Use Clipboard API if available
  //     if (navigator.clipboard && navigator.clipboard.write) {
  //       await navigator.clipboard
  //         .write([
  //           new ClipboardItem({
  //             "image/svg+xml": svgBlob,
  //             "text/plain": svgString,
  //           }),
  //         ])
  //         .then(() => alert("SVG copied to clipboard"));
  //       console.log("SVG copied to clipboard as an image!");
  //     } else {
  //       throw new Error("Clipboard API not supported on this browser.");
  //     }
  //   } catch (error) {
  //     console.error("Failed to copy SVG to clipboard:", error);
  //   }
  // };

  const copySvgTextToClipboard = async () => {
    const svgString = createSvgFromCanvas();
    if (!svgString) return;

    try {
      await navigator.clipboard.writeText(svgString);
      alert("SVG copied to clipboard as text!");
    } catch (error) {
      console.error("Failed to copy SVG text:", error);
    }
  };

  const copyToClipboard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) {
        const item = new ClipboardItem({ "image/png": blob });
        navigator.clipboard.write([item]).then(() => {
          alert("Image copied to clipboard!");
        });
      }
    });
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleColorChange = (index: number, newColor: string) => {
    const updatedColors = [...colors];
    updatedColors[index] = newColor;
    setColors(updatedColors);
  };

  const addColor = () => {
    setColors([...colors, "#FFFFFF"]);
  };

  const deleteColor = (index: number) => {
    const updatedColors = colors.filter((_, i) => i !== index);
    setColors(updatedColors);
  };

  const resetToDefaultColors = () => {
    setColors([...defaultColors]);
  };

  const clearColorsFromMemory = () => {
    nextLocalStorage()?.removeItem("colors");
    nextLocalStorage()?.removeItem("colorWeights");
    resetToDefaultColors();
  };

  // Helper function to find the nearest color from a given set of colors
  const findNearestColor = (
    r: number,
    g: number,
    b: number,
    colorPalette: string[]
  ) => {
    let closestColor = colorPalette[0];
    let smallestDistance = Infinity;

    for (const hexColor of colorPalette) {
      const colorInt = parseInt(hexColor.slice(1), 16);
      const pr = (colorInt >> 16) & 0xff;
      const pg = (colorInt >> 8) & 0xff;
      const pb = colorInt & 0xff;

      const distance = Math.sqrt((pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2);

      if (distance < smallestDistance) {
        smallestDistance = distance;
        closestColor = hexColor;
      }
    }
    return closestColor;
  };

  return (
    <div className="flex flex-col p-4 w-screen items-center max-w-4xl m-auto">
      <header className="flex justify-between items-center w-full pb-4">
        <h1>Silicon Halli Pixelator</h1>
        <div>
          <input
            type="file"
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
          />
          <Button onClick={triggerFileInput}>
            <Upload className="mr-2 h-4 w-4" /> Upload Image
          </Button>
        </div>
      </header>

      <div className="flex space-x-4 justify-center gap-4 border border-slate-100 bg-slate-50 p-2 flex-grow w-full flex-wrap">
        <div>
          <h3 className="text-center mb-2">Original Image</h3>
          <canvas
            ref={previewCanvasRef}
            className={`border border-gray-300 w-${artboardWidth} h-${artboardHeight}`}
            width={artboardWidth}
            height={artboardHeight}
          />
        </div>
        <div>
          <h3 className="text-center mb-2">Pixelated Image</h3>
          <canvas
            ref={canvasRef}
            className={`border border-gray-300 w-${artboardWidth} h-${artboardHeight}`}
            width={artboardWidth}
            height={artboardHeight}
          />
        </div>
      </div>
      <div className="flex justify-center p-4 gap-2 flex-wrap">
        <Button onClick={() => exportImage("png")} disabled={!image}>
          <Download className="mr-2 h-4 w-4" /> Export PNG
        </Button>
        <Button onClick={copyToClipboard} disabled={!image}>
          <Clipboard className="mr-2 h-4 w-4" /> Copy to Clipboard
        </Button>
        <Button onClick={copySvgTextToClipboard} disabled={!image}>
          <Clipboard className="mr-2 h-4 w-4" /> Copy SVG to Clipboard
        </Button>
      </div>
      <div className="flex justify-between items-center gap-2 sm:flex-row flex-col w-full">
        <div className="flex flex-col gap-2 w-full border border-slate-100 bg-slate-50 p-8 rounded-lg">
          <span>Pixel Size:</span>
          <Slider
            value={[pixelSize]}
            onValueChange={(value) => setPixelSize(value[0])}
            min={0}
            max={50}
            step={1}
          />
          <div className="flex justify-between items-center gap-8">
            <span>{pixelSize}</span>
            <span>50</span>
          </div>
        </div>
        <div className="flex flex-col gap-2 border border-slate-100 bg-slate-50 p-8 rounded-lg sm:w-auto w-full">
          <span>Canvas Dimensions:</span>
          <div className="flex space-x-2">
            <Input
              type="number"
              value={artboardWidth}
              onChange={(e) => setArtboardWidth(Number(e.target.value))}
              className="w-20"
              min="100"
              max="1000"
            />
            <span>x</span>
            <Input
              type="number"
              value={artboardHeight}
              onChange={(e) => setArtboardHeight(Number(e.target.value))}
              className="w-20"
              min="100"
              max="1000"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center p-4">
        <span>Color Mode:</span>
        <Switch checked={colorMode} onCheckedChange={setColorMode} />
      </div>
      {colorMode && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3>Modify Color Palette:</h3>
            <Button onClick={resetToDefaultColors}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Use Default Colors
            </Button>
          </div>
          <div className="flex flex-col space-y-2">
            {colors.map((color, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Input
                  value={color}
                  onChange={(e) => handleColorChange(index, e.target.value)}
                  className="w-32"
                />
                <div
                  className="h-8 w-8 rounded"
                  style={{ backgroundColor: color }}
                />
                <Slider
                  value={[colorWeights[color] || 1]}
                  onValueChange={(value) =>
                    handleColorWeightChange(color, value[0])
                  }
                  min={0}
                  max={10}
                  step={0.1}
                  className="w-64"
                />
                {colorWeights[color] || 1}
                <Button
                  variant="destructive"
                  onClick={() => deleteColor(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <Button onClick={addColor}>
            <Plus className="mr-2 h-4 w-4" /> Add Color
          </Button>
          <Button onClick={clearColorsFromMemory}>
            <Trash2 className="mr-2 h-4 w-4" /> Clear Colors
          </Button>
        </div>
      )}
    </div>
  );
};

export default PixelArtGenerator;
