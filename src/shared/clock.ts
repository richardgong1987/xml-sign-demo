import {Injectable} from "@nestjs/common";

/**
 * A port, expressed as an abstract class so it survives compilation and can serve as
 * an injection token. Business code reads the time through it, which is what lets a
 * test bind a fixed clock and make assertion validity windows assertable.
 */
export abstract class Clock {
    abstract now(): Date;
}

@Injectable()
export class SystemClock extends Clock {
    now(): Date {
        return new Date();
    }
}
