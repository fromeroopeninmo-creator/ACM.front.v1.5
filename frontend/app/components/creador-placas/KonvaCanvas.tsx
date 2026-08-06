"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import Konva from "konva";
import { Circle, Image as KonvaImage, Layer, Line, Rect, Stage, Text, Transformer } from "react-konva";
import type { CanvasElement, PropertyData } from "./types";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "./templates";

export type KonvaCanvasHandle = { exportImage: (mime: "image/png" | "image/jpeg") => string };

type Props = {
  elements: CanvasElement[];
  data: PropertyData;
  images: Array<string | null>;
  logoUrl: string | null;
  brandText: string;
  contactText: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<CanvasElement>) => void;
  scale: number;
};

function useHtmlImage(src: string | null | undefined) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!src) { setImage(null); return; }
    const next = new window.Image();
    next.crossOrigin = "anonymous";
    next.onload = () => setImage(next);
    next.onerror = () => setImage(null);
    next.src = src;
    return () => { next.onload = null; next.onerror = null; };
  }, [src]);
  return image;
}

function resolveText(el: CanvasElement, data: PropertyData, brandText: string, contactText: string): string {
  if (el.textRole === "price") return data.showPrice ? `${data.currency || "USD"} ${data.price || "CONSULTAR"}` : "";
  if (el.textRole === "features") {
    if (!data.showFeatures) return "";
    return [
      data.ambients && `${data.ambients} AMBIENTES`,
      data.bedrooms && `${data.bedrooms} DORMITORIOS`,
      data.bathrooms && `${data.bathrooms} BAÑOS`,
      data.garages && `${data.garages} COCHERA${data.garages === "1" ? "" : "S"}`,
      data.coveredArea && `${data.coveredArea} M² CUB.`,
      data.totalArea && `${data.totalArea} M² TOT.`,
    ].filter(Boolean).join("   ·   ");
  }
  if (el.textRole === "brand") return data.showFooter ? brandText : "";
  if (el.textRole === "contact") return data.showFooter ? contactText : "";
  if (el.textRole && el.textRole in data) {
    if (el.textRole === "location" && !data.showLocation) return "";
    return String(data[el.textRole as keyof PropertyData] ?? "");
  }
  return el.text || "";
}

const CanvasImage = ({ el, src, selected, onSelect, onChange }: { el: CanvasElement; src: string | null; selected: boolean; onSelect: () => void; onChange: (patch: Partial<CanvasElement>) => void }) => {
  const img = useHtmlImage(src);
  const ref = useRef<Konva.Image>(null);
  const trRef = useRef<Konva.Transformer>(null);
  useEffect(() => {
    if (selected && ref.current && trRef.current) { trRef.current.nodes([ref.current]); trRef.current.getLayer()?.batchDraw(); }
  }, [selected]);
  const crop = useMemo(() => {
    if (!img) return undefined;
    const targetRatio = el.width / el.height;
    const sourceRatio = img.width / img.height;
    if (sourceRatio > targetRatio) {
      const cropWidth = img.height * targetRatio;
      return { x: (img.width - cropWidth) * ((el.cropX ?? 50) / 100), y: 0, width: cropWidth, height: img.height };
    }
    const cropHeight = img.width / targetRatio;
    return { x: 0, y: (img.height - cropHeight) * ((el.cropY ?? 50) / 100), width: img.width, height: cropHeight };
  }, [img, el.width, el.height, el.cropX, el.cropY]);
  return <>
    <KonvaImage ref={ref} image={img || undefined} x={el.x} y={el.y} width={el.width} height={el.height} crop={crop} cornerRadius={el.cornerRadius || 0} rotation={el.rotation || 0} opacity={el.opacity ?? 1} draggable={!el.locked && el.draggable !== false} onClick={onSelect} onTap={onSelect}
      onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
      onTransformEnd={() => { const node = ref.current; if (!node) return; const sx=node.scaleX(), sy=node.scaleY(); node.scaleX(1); node.scaleY(1); onChange({ x:node.x(), y:node.y(), width:Math.max(40,node.width()*sx), height:Math.max(40,node.height()*sy), rotation:node.rotation() }); }} />
    {!img && <><Rect x={el.x} y={el.y} width={el.width} height={el.height} fill="#dbe2ea" cornerRadius={el.cornerRadius || 0} onClick={onSelect}/><Text x={el.x} y={el.y + el.height/2 - 18} width={el.width} text={el.name.toUpperCase()} fontSize={28} fontStyle="bold" align="center" fill="#64748b" listening={false}/></>}
    {selected && !el.locked && <Transformer ref={trRef} rotateEnabled enabledAnchors={["top-left","top-right","bottom-left","bottom-right","middle-left","middle-right","top-center","bottom-center"]} boundBoxFunc={(oldBox,newBox)=>newBox.width<40||newBox.height<40?oldBox:newBox}/>} 
  </>;
};

const ShapeElement = ({ el, textValue, selected, onSelect, onChange }: { el: CanvasElement; textValue: string; selected: boolean; onSelect:()=>void; onChange:(patch:Partial<CanvasElement>)=>void }) => {
  const ref = useRef<Konva.Node>(null);
  const trRef = useRef<Konva.Transformer>(null);
  useEffect(()=>{ if(selected&&ref.current&&trRef.current){trRef.current.nodes([ref.current]);trRef.current.getLayer()?.batchDraw();}},[selected]);
  const common:any={ref,x:el.x,y:el.y,rotation:el.rotation||0,opacity:el.opacity??1,draggable:!el.locked&&el.draggable!==false,onClick:onSelect,onTap:onSelect,onDragEnd:(e:any)=>onChange({x:e.target.x(),y:e.target.y()}),onTransformEnd:()=>{const node:any=ref.current;if(!node)return;const sx=node.scaleX(),sy=node.scaleY();node.scaleX(1);node.scaleY(1);onChange({x:node.x(),y:node.y(),width:Math.max(20,(node.width?.()||el.width)*sx),height:Math.max(20,(node.height?.()||el.height)*sy),rotation:node.rotation()});}};
  let node=null;
  if(el.kind==="text") node=<Text {...common} text={textValue} width={el.width} height={el.height} fontSize={el.fontSize||32} fontFamily={el.fontFamily||"Arial"} fontStyle={el.fontStyle||"normal"} fill={el.fill||"#111827"} align={el.align||"left"} verticalAlign="middle" wrap="word"/>;
  else if(el.kind==="rect") node=<Rect {...common} width={el.width} height={el.height} fill={el.fill||"transparent"} stroke={el.stroke} strokeWidth={el.strokeWidth||0} cornerRadius={el.cornerRadius||0}/>;
  else if(el.kind==="circle") node=<Circle {...common} x={el.x+el.width/2} y={el.y+el.height/2} radius={Math.min(el.width,el.height)/2} fill={el.fill||"transparent"} stroke={el.stroke} strokeWidth={el.strokeWidth||0}/>;
  else if(el.kind==="line") node=<Line {...common} points={[0,0,el.width,el.height]} stroke={el.stroke||el.fill||"#111827"} strokeWidth={el.strokeWidth||4}/>;
  return <>{node}{selected&&!el.locked&&<Transformer ref={trRef} rotateEnabled enabledAnchors={el.kind==="text"?["middle-left","middle-right"]:undefined} boundBoxFunc={(oldBox,newBox)=>newBox.width<20||newBox.height<20?oldBox:newBox}/>}</>;
};

const KonvaCanvas = forwardRef<KonvaCanvasHandle, Props>(function KonvaCanvas({elements,data,images,logoUrl,brandText,contactText,selectedId,onSelect,onChange,scale},ref){
  const stageRef=useRef<Konva.Stage>(null);
  useImperativeHandle(ref,()=>({exportImage:(mime)=>stageRef.current?.toDataURL({pixelRatio:1,mimeType:mime,quality:.94})||""}),[]);
  const sorted=[...elements].filter(e=>e.visible!==false).sort((a,b)=>a.zIndex-b.zIndex);
  return <Stage ref={stageRef} width={DESIGN_WIDTH*scale} height={DESIGN_HEIGHT*scale} scaleX={scale} scaleY={scale} onMouseDown={(e)=>{if(e.target===e.target.getStage())onSelect(null)}} onTouchStart={(e)=>{if(e.target===e.target.getStage())onSelect(null)}}>
    <Layer>
      {sorted.map(el=>{
        if(el.kind==="image") return <CanvasImage key={el.id} el={el} src={el.id==="logo"?logoUrl:(images[el.imageSlot||0]||el.imageUrl||null)} selected={selectedId===el.id} onSelect={()=>onSelect(el.id)} onChange={patch=>onChange(el.id,patch)}/>;
        return <ShapeElement key={el.id} el={el} textValue={resolveText(el,data,brandText,contactText)} selected={selectedId===el.id} onSelect={()=>onSelect(el.id)} onChange={patch=>onChange(el.id,patch)}/>;
      })}
      {data.showStatus&&data.status&&<><Rect x={370} y={560} width={420} height={100} fill="#b91c1c" rotation={-8} cornerRadius={18} shadowBlur={20}/><Text x={390} y={580} width={380} height={60} text={data.status} fill="#ffffff" fontSize={48} fontStyle="bold" align="center" verticalAlign="middle" rotation={-8}/></>}
      {data.showLogo&&logo&&<KonvaImage image={logo} x={55} y={1230} width={82} height={82}/>}
    </Layer>
  </Stage>;
});
export default KonvaCanvas;
