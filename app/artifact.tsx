"use client";

import React, { useState, useRef, useEffect, ChangeEvent } from "react";
import {
  Upload,
  Download,
  Trash2,
  Plus,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
  Clipboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

// interface ColorWeights {
//   [color: string]: number;
// }

const defaultColors: string[] = [
  "#F53698",
  "#F0D105",
  "#E67802",
  "#F4AF89",
  "#03E01D",
  "#03E0DA",
  "#0479C3",
];

const PixelArtGenerator: React.FC = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [pixelSize, setPixelSize] = useState<number>(10);
  const [artboardWidth, setArtboardWidth] = useState<number>(400);
  const [artboardHeight, setArtboardHeight] = useState<number>(400);
  const [colorMode, setColorMode] = useState<boolean>(false);
  const [colors, setColors] = useState<string[]>(() => {
    const storedColors = localStorage.getItem("colors");
    return storedColors ? JSON.parse(storedColors) : [...defaultColors];
  });

  const [weights, setWeights] = useState<{ [color: string]: number }>(() => {
    const storedWeights = localStorage.getItem("colorWeights");
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
  );

  const [colorSwaps, setColorSwaps] = useState<
    { original: string; newColor: string }[]
  >([]);
  const [applyColorSwap, setApplyColorSwap] = useState<boolean>(true);

  const [showColorSwap, setShowColorSwap] = useState<boolean>(false); // For toggleable accordion

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
      const scaledWidth = Math.floor(artboardWidth / pixelSize);
      const scaledHeight = Math.floor(artboardHeight / pixelSize);

      // Use an offscreen canvas for the intermediate step
      const offscreenCanvas = document.createElement("canvas");
      offscreenCanvas.width = scaledWidth;
      offscreenCanvas.height = scaledHeight;
      const offscreenCtx = offscreenCanvas.getContext("2d");

      // Draw scaled down version to offscreen canvas
      offscreenCtx.drawImage(previewCanvas, 0, 0, scaledWidth, scaledHeight);

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

      if (applyColorSwap && colorSwaps.length > 0) {
        applyColorSwaps(imageData);
      }

      ctx.putImageData(imageData, 0, 0);
    };

    const applyColorSwaps = (imageData: ImageData) => {
      for (let i = 0; i < imageData.data.length; i += 4) {
        const pixelColor = rgbToHex(
          imageData.data[i],
          imageData.data[i + 1],
          imageData.data[i + 2]
        );

        // Only log if needed, or on specific conditions
        if (colorSwaps.length > 0) {
          const swap = colorSwaps.find((swap) => swap.original === pixelColor);
          if (swap) {
            const [r, g, b] = hexToRgb(swap.newColor);
            // Perform the swap without logging every pixel
            console.log("hello", pixelColor);
            imageData.data[i] = r;
            imageData.data[i + 1] = g;
            imageData.data[i + 2] = b;
          }
        }
      }
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
    colorSwaps,
    applyColorSwap,
    colorWeights,
  ]);

  useEffect(() => {
    localStorage.setItem("colors", JSON.stringify(colors));
    localStorage.setItem("colorWeights", JSON.stringify(colorWeights));
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
    localStorage.removeItem("colors");
    localStorage.removeItem("colorWeights");
    resetToDefaultColors();
  };

  const addColorSwap = () => {
    setColorSwaps([
      ...colorSwaps,
      { original: colors[0], newColor: colors[0] },
    ]);
  };

  const deleteColorSwap = (index: number) => {
    const updatedSwaps = colorSwaps.filter((_, i) => i !== index);
    setColorSwaps(updatedSwaps);
  };

  const handleColorSwapChange = (
    index: number,
    key: "original" | "newColor",
    newColor: string
  ) => {
    const updatedSwaps = [...colorSwaps];
    updatedSwaps[index][key] = newColor;
    setColorSwaps(updatedSwaps);
  };

  return (
    <div className="flex flex-col space-y-4 p-4 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
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

      <div className="flex items-center space-x-2">
        <span>Pixel Size:</span>
        <Slider
          value={[pixelSize]}
          onValueChange={(value) => setPixelSize(value[0])}
          min={1}
          max={50}
          step={1}
        />
        <span>{pixelSize}</span>
      </div>

      <div className="flex items-center space-x-2">
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

      <div className="flex items-center justify-between mt-4">
        <h3>Color Swap Options:</h3>
        <Button
          variant="ghost"
          onClick={() => setShowColorSwap(!showColorSwap)}
        >
          {showColorSwap ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </div>

      {showColorSwap && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <span>Apply Color Swaps:</span>
            <Switch
              checked={applyColorSwap}
              onCheckedChange={setApplyColorSwap}
            />
          </div>
          {colorSwaps.map((swap, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Select
                value={swap.original}
                onValueChange={(value: string) =>
                  handleColorSwapChange(index, "original", value)
                }
              >
                <SelectTrigger className="w-32">
                  <span>
                    <div
                      style={{
                        backgroundColor: swap.original,
                        width: "16px",
                        height: "16px",
                        borderRadius: "4px",
                      }}
                    ></div>
                    {swap.original}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {colors.map((color) => (
                    <SelectItem key={color} value={color}>
                      <div
                        style={{
                          backgroundColor: color,
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                        }}
                      ></div>
                      {color}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span>→</span>
              <Select
                value={swap.newColor}
                onValueChange={(value: string) =>
                  handleColorSwapChange(index, "newColor", value)
                }
              >
                <SelectTrigger className="w-32">
                  <span>
                    <div
                      style={{
                        backgroundColor: swap.newColor,
                        width: "16px",
                        height: "16px",
                        borderRadius: "4px",
                      }}
                    ></div>
                    {swap.newColor}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {colors.map((color) => (
                    <SelectItem key={color} value={color}>
                      <div
                        style={{
                          backgroundColor: color,
                          width: "16px",
                          height: "16px",
                          borderRadius: "4px",
                        }}
                      ></div>
                      {color}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="destructive"
                onClick={() => deleteColorSwap(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <Button onClick={addColorSwap}>
            <Plus className="mr-2 h-4 w-4" /> Add Color Swap
          </Button>
        </div>
      )}

      <div className="flex space-x-4 justify-center mt-4">
        <div>
          <h3 className="text-center mb-2">Original Image</h3>
          <canvas ref={previewCanvasRef} className="border border-gray-300" />
        </div>
        <div>
          <h3 className="text-center mb-2">Pixelated Image</h3>
          <canvas ref={canvasRef} className="border border-gray-300" />
        </div>
      </div>

      <div className="flex space-x-2 justify-center mt-4">
        <Button onClick={() => exportImage("png")} disabled={!image}>
          <Download className="mr-2 h-4 w-4" /> Export PNG
        </Button>
        <Button onClick={() => exportImage("gif")} disabled={!image}>
          <Download className="mr-2 h-4 w-4" /> Export GIF
        </Button>
        <Button onClick={copyToClipboard} disabled={!image}>
          <Clipboard className="mr-2 h-4 w-4" /> Copy to Clipboard
        </Button>
      </div>
    </div>
  );
};

export default PixelArtGenerator;
