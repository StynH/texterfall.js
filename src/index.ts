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
    lifespan: number;
    color: string;
}

type CharacterStream = {
    characterDroplets: CharacterDroplet[];
    offsetX: number;
    fallingSpeed: number;
    streamColor: string;
}

type Config = {
    canvasId: string;
    fontName: string;
    fontSize: number;
    characters: string;
    characterColor: string;
    backgroundColor: string;
    randomColors: boolean;
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

class NumberHelper{

    static randomIntBetween(min: number, max: number): number{
        return Math.floor(Math.random() * (max - min + 1) + min)
    }

    static lerp(a: number, b: number, u: number): number{
        return (1 - u) * a + u * b;
    }

}

class ColorHelper{

    static randomColor(minRgb: number = 0): string{
        return ColorHelper.rgbToHex(
            NumberHelper.randomIntBetween(minRgb, 255),
            NumberHelper.randomIntBetween(minRgb, 255),
            NumberHelper.randomIntBetween(minRgb, 255)
        );
    }

    static transitionToColor(start: string, end: string, step: number): string{
        const startRgb = ColorHelper.hexToRgb(start)!;
        const endRgb = ColorHelper.hexToRgb(end)!;
        const r = Math.floor(NumberHelper.lerp(startRgb.r, endRgb.r, step));
        const g = Math.floor(NumberHelper.lerp(startRgb.g, endRgb.g, step));
        const b = Math.floor(NumberHelper.lerp(startRgb.b, endRgb.b, step));
        return ColorHelper.rgbToHex(r, g, b);
    }

    static hexToRgb(hex: string): RGB | null {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    static rgbToHex(r: number, g: number, b: number): string {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

}

export class Texterfall{

    private static CHARACTER_DROPLET_LIFESPAN_THRESHOLD: number = 92;
    private static RANDOM_RGB_MINIMUM: number = 100;

    private config: Config;
    private canvas: Canvas;
    private characterLibrary: CharacterRecord[];
    private characterStreams: CharacterStream[];
    private characterMargin: number;
    private timer: DeltaTime;
    private interval: number;

    constructor(config: Config){
        const defaultConfig: Config = {
            canvasId: "testCanvas",
            fontName: "Arial",
            fontSize: 16,
            characters: "0123456789",
            characterColor: "#39FF14",
            backgroundColor: "#000000",
            randomColors: false,
            fps: 144
        }
        this.config = this.mergeDefaultConfig(config, defaultConfig);

        this.canvas = this.loadCanvas();
        this.characterLibrary = this.createCharacterLibrary();
        this.characterStreams = [];
        this.characterMargin = this.calculateStreamMargin(this.getWidestCharacterFromStream());

        this.timer = new DeltaTime();
        this.interval = 1000 / this.config.fps;

        this.clearCanvas();
    }

    public start(): void{
        this.characterStreams = this.generateCharacterStreams(this.getWidestCharacterFromStream());
        _.forEach(this.characterStreams, (characterStream: CharacterStream) => {
            characterStream.characterDroplets.push(this.generateCharacterDroplet(characterStream));
        });

        setInterval(this.update.bind(this), this.interval);
    }

    private mergeDefaultConfig(config: Config, defaultConfig: Config): Config{
        if(isNull(config) || isUndefined(config)){
            return defaultConfig;
        }

        Object.keys(defaultConfig).forEach((key: string) => {
            if (!config.hasOwnProperty(key)) {
                //@ts-ignore
                config[key] = defaultConfig[key];
            }
        });

        return config;
    }

    private update(): void{
        this.timer.update();
        this.updateCharacterStreams();
        this.draw();
    }

    private draw(): void{
        this.clearCanvas();
        _.forEach(this.characterStreams, (characterStream: CharacterStream) => {
            this.drawCharacterStream(characterStream);
        });
    }

    /*=============================================
    Canvas
    =============================================*/

    private clearCanvas(): void{
        this.canvas.context.fillStyle = this.config.backgroundColor;
        this.canvas.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    private setFontColor(color: string): void{
        this.canvas.context.fillStyle = color;
    }

    private loadCanvas(): Canvas{
        const c = <HTMLCanvasElement>document.getElementById(this.config.canvasId);
        const ctx = c.getContext("2d")!;

        ctx.font = this.config.fontSize + "px " + this.config.fontName;

        return { element: c, context: ctx, width: c.width, height: c.height };
    }

    private createCharacterLibrary(): CharacterRecord[]{
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

    /*=============================================
    Character Streams
    =============================================*/

    private generateCharacterStreams(widestCharacterWidth: number): CharacterStream[]{
        const characterStreams: CharacterStream[] = [];
        const amountOfStreamsFitable = Math.floor(this.canvas.width / widestCharacterWidth);

        let x = 0;
        for(let i = 0; i < amountOfStreamsFitable; ++i){
            characterStreams.push({
                characterDroplets: [],
                offsetX: x,
                fallingSpeed: NumberHelper.randomIntBetween(5, 45) / 100,
                streamColor: this.config.randomColors ? ColorHelper.randomColor(Texterfall.RANDOM_RGB_MINIMUM) : this.config.characterColor
            });

            x += Math.round(((widestCharacterWidth + this.characterMargin) + Number.EPSILON) * 100) / 100;
        }

        return characterStreams;
    }

    private getWidestCharacterFromStream(): number{
        let widest = Number.MIN_SAFE_INTEGER;

        _.forEach(this.characterLibrary, (character: CharacterRecord) => {
            if(character.width > widest){
                widest = character.width;
            }
        });

        return widest;
    }

    private calculateStreamMargin(widestCharacterWidth: number): number{
        const amountOfStreamsFitable = Math.floor(this.canvas.width / widestCharacterWidth);
        const spaceLeft = this.canvas.width - (amountOfStreamsFitable * widestCharacterWidth);
        const margin = spaceLeft / amountOfStreamsFitable;
        return Math.round((margin + Number.EPSILON) * 100) / 100;
    }

    private canGenerateDroplet(characterStream:CharacterStream): boolean{
        return characterStream.characterDroplets.length == 0 || characterStream.characterDroplets[characterStream.characterDroplets.length - 1].position.y + this.config.fontSize < this.canvas.height;
    }

    private generateCharacterDroplet(characterStream: CharacterStream): CharacterDroplet{
        let position = this.config.fontSize;
        if(characterStream.characterDroplets.length > 0){
            position = characterStream.characterDroplets[characterStream.characterDroplets.length - 1].position.y + this.config.fontSize;
        }
        return {
            character: this.characterLibrary[Math.floor(Math.random() * this.characterLibrary.length)].character,
            position: {
                x: characterStream.offsetX,
                y: position
            },
            lifespan: 100,
            color: characterStream.streamColor
        };
    }

    private drawCharacterStream(characterStream: CharacterStream): void{
        _.forEach(characterStream.characterDroplets, (characterDroplet: CharacterDroplet) => {
            this.setFontColor(characterDroplet.color);
            this.canvas.context.fillText(characterDroplet.character, characterDroplet.position.x, characterDroplet.position.y);
        });
    }

    private resetCharacterStream(characterStream: CharacterStream) {
        characterStream.fallingSpeed = NumberHelper.randomIntBetween(5, 45) / 100;
        if(this.config.randomColors){
            characterStream.streamColor = ColorHelper.randomColor(Texterfall.RANDOM_RGB_MINIMUM);
        }
    }

    private updateCharacterStreams(): void{
        _.forEach(this.characterStreams, (characterStream: CharacterStream) => {
            this.updateCharacterStream(characterStream);
        });
    }

    private updateCharacterStream(characterStream: CharacterStream): void{
        let cleanStream = false;
        _.forEach(characterStream.characterDroplets, (characterDroplet: CharacterDroplet) => {
            if(characterDroplet.lifespan > 0){
                characterDroplet.lifespan -= characterStream.fallingSpeed * this.timer.deltaTime;
                if(characterDroplet.lifespan < 0){
                    characterDroplet.lifespan = 0;
                    cleanStream = true;
                }

                characterDroplet.color = ColorHelper.transitionToColor(this.config.backgroundColor, characterStream.streamColor, characterDroplet.lifespan / 100);
            }
        });

        const allDropletsBelowThreshold = _.every(characterStream.characterDroplets, (characterDroplet: CharacterDroplet) => {
            return characterDroplet.lifespan <= Texterfall.CHARACTER_DROPLET_LIFESPAN_THRESHOLD;
        });

        if(allDropletsBelowThreshold){
            if(this.canGenerateDroplet(characterStream)){
                characterStream.characterDroplets.push(this.generateCharacterDroplet(characterStream));
            }
        }

        if(cleanStream){
            characterStream.characterDroplets = _.filter(characterStream.characterDroplets, (characterDroplet: CharacterDroplet) =>{
                return characterDroplet.lifespan > 0;
            });
        }

        if(characterStream.characterDroplets.length == 0){
            this.resetCharacterStream(characterStream);
        }
    }
}
