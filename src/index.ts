import _, { isNull, isUndefined } from "lodash";

type Canvas = {
    element: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
    width: number,
    height: number
}

type RGB = {
    r: number;
    g: number;
    b: number;
}

type Position = {
    x: number;
    y: number;
}

type CharacterRecord = {
    character: string;
    width: number;
}

type CharacterDroplet = {
    character: string;
    position: Position;
}

type CharacterStream = {
    characterDroplets: CharacterDroplet[];
    offsetX: number;
    fallingSpeed: number;
    timer: number;
}

interface IConfig{
    canvasId: string;
    fontName: string;
    fontSize: number;
    characters: string;
    characterColor: string;
    backgroundColor: string;
    fps: number;
}

class DeltaTime{
    lastUpdate: number;
    deltaTime: number;

    constructor() {
        this.lastUpdate = Date.now();
        this.deltaTime = 0;
    }

    update(): void{
        const now = Date.now();
        this.deltaTime = now - this.lastUpdate;
        this.lastUpdate = now;
    }
}

class CanvasHelper{

    static getTextWidth(canvas: Canvas, text: string, font: string) {
        const context = canvas.context;
        context.font = font;
        const metrics = context.measureText(text);
        return metrics.width;
    }

}

export class Texterfall{

    private config: IConfig;
    private canvas: Canvas;
    private characterLibrary: CharacterRecord[];
    private characterStreams: CharacterStream[];
    private characterMargin: number;
    private timer: DeltaTime;
    private interval: number;

    constructor(config: IConfig | null){
        const defaultConfig: IConfig = {
            canvasId: "testCanvas",
            fontName: "Arial",
            fontSize: 16,
            characters: "0123456789",
            characterColor: "#39FF14",
            backgroundColor: "#000000",
            fps: 144
        }

        if(isNull(config) || isUndefined(config)){
            this.config = defaultConfig;
        }
        else{
            this.config = config;
        }

        this.canvas = this.LoadCanvas();
        this.characterLibrary = this.CreateCharacterLibrary();
        this.characterStreams = [];
        this.characterMargin = this.CalculateStreamMargin(this.GetWidestCharacterFromStream());

        this.timer = new DeltaTime();
        this.interval = 1000 / this.config.fps;

        this.clearCanvas();
    }

    public start(): void{
        this.characterStreams = this.GenerateCharacterStreams(this.GetWidestCharacterFromStream());
        _.forEach(this.characterStreams, (characterStream: CharacterStream) => {
            characterStream.characterDroplets.push(this.GenerateCharacterDroplet(characterStream));
        });

        setInterval(this.update.bind(this), this.interval);
    }

    private update(): void{
        this.timer.update();
        this.draw();
    }

    private draw(): void{
        this.setFontColor();
        _.forEach(this.characterStreams, (characterStream: CharacterStream) => {
            this.DrawCharacterStream(characterStream);
        });
    }

    private clearCanvas(): void{
        this.canvas.context.fillStyle = this.config.backgroundColor;
        this.canvas.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    private setFontColor(): void{
        this.canvas.context.fillStyle = this.config.characterColor;
    }

    private LoadCanvas(): Canvas{
        const c = <HTMLCanvasElement>document.getElementById(this.config.canvasId);
        const ctx = c.getContext("2d")!;

        ctx.font = this.config.fontSize + "px " + this.config.fontName;

        return { element: c, context: ctx, width: c.width, height: c.height };
    }

    private CreateCharacterLibrary(): CharacterRecord[]{
        const characterLibrary: CharacterRecord[] = [];

        _.forEach(this.config.characters.split(''), (character: string) => {
            const width = CanvasHelper.getTextWidth(this.canvas, character, this.config.fontSize + " " + this.config.fontName);
            characterLibrary.push({
                character: character,
                width: width
            });
        });

        return characterLibrary;
    }

    private GenerateCharacterStreams(widestCharacterWidth: number): CharacterStream[]{
        const characterStreams: CharacterStream[] = [];
        const amountOfStreamsFittable = Math.floor(this.canvas.width / widestCharacterWidth);
        
        let x = 0;
        for(let i = 0; i < amountOfStreamsFittable; ++i){
            characterStreams.push({
                characterDroplets: [],
                offsetX: x,
                fallingSpeed: 5,
                timer: 0
            });

            x += Math.round(((widestCharacterWidth + this.characterMargin) + Number.EPSILON) * 100) / 100;
        }

        return characterStreams;
    }

    private GetWidestCharacterFromStream(): number{
        let widest = Number.MIN_SAFE_INTEGER;

        _.forEach(this.characterLibrary, (character: CharacterRecord) => {
            if(character.width > widest){
                widest = character.width;
            }
        });

        return widest;
    }

    private CalculateStreamMargin(widestCharacterWidth: number): number{
        const amountOfStreamsFittable = Math.floor(this.canvas.width / widestCharacterWidth);
        const spaceLeft = this.canvas.width - (amountOfStreamsFittable * widestCharacterWidth);
        const margin = spaceLeft / amountOfStreamsFittable;
        return Math.round((margin + Number.EPSILON) * 100) / 100;
    }

    private GenerateCharacterDroplet(characterStream: CharacterStream): CharacterDroplet{
        let gapCloser = this.config.fontSize / 4;
        if(characterStream.characterDroplets.length > 0){
            gapCloser = (characterStream.characterDroplets.length + 1) * (this.config.fontSize / 4);
        }
        return {
            character: this.characterLibrary[Math.floor(Math.random() * this.characterLibrary.length)].character,
            position: {
                x: characterStream.offsetX,
                y: ((characterStream.characterDroplets.length * this.config.fontSize) + this.config.fontSize) - gapCloser
            }
        };
    }
    
    private DrawCharacterStream(CharacterStream: CharacterStream): void{
        _.forEach(CharacterStream.characterDroplets, (characterDroplet: CharacterDroplet) => {
            this.canvas.context.fillText(characterDroplet.character, characterDroplet.position.x, characterDroplet.position.y);
        });
    }

    private transitionToColor(start: string, end: string, step: number): string{
        const startRgb = this.HexToRgb(start)!;
        const endRgb = this.HexToRgb(end)!;
        const r = Math.floor(this.Lerp(startRgb.r, endRgb.r, step));
        const g = Math.floor(this.Lerp(startRgb.g, endRgb.g, step));
        const b = Math.floor(this.Lerp(startRgb.b, endRgb.b, step));
        return this.RgbToHex(r, g, b);
    }

    private HexToRgb(hex: string): RGB | null {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    private RgbToHex(r: number, g: number, b: number): string {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    private Lerp(a: number, b: number, u: number): number{
        return (1 - u) * a + u * b;
    }
}