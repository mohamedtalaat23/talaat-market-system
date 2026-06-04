export class EscPosFormatter {
  // ESC/POS Command Constants
  private static readonly ESC = 0x1b;
  private static readonly GS = 0x1d;

  private static readonly CMD_INIT = new Uint8Array([this.ESC, 0x40]); // ESC @
  private static readonly CMD_ALIGN_LEFT = new Uint8Array([this.ESC, 0x61, 0x00]); // ESC a 0
  private static readonly CMD_ALIGN_CENTER = new Uint8Array([this.ESC, 0x61, 0x01]); // ESC a 1

  private static readonly CMD_BOLD_ON = new Uint8Array([this.ESC, 0x45, 0x01]); // ESC E 1
  private static readonly CMD_BOLD_OFF = new Uint8Array([this.ESC, 0x45, 0x00]); // ESC E 0

  private static readonly CMD_SIZE_BIG = new Uint8Array([this.GS, 0x21, 0x11]); // GS ! 0x11 (Double height + width)
  private static readonly CMD_SIZE_NORMAL = new Uint8Array([this.GS, 0x21, 0x00]); // GS ! 0x00 (Normal)

  private static readonly CMD_CUT = new Uint8Array([this.GS, 0x56, 0x42, 0x00]); // GS V 66 0 (Feed & Cut)
  private static readonly CMD_DRAWER_KICK = new Uint8Array([this.ESC, 0x70, 0x00, 0x19, 0xfa]); // ESC p 0 25 250

  /**
   * Helper to merge multiple Uint8Arrays into a single buffer.
   */
  private static concatBuffers(buffers: Uint8Array[]): Uint8Array {
    let totalLength = 0;
    buffers.forEach((buf) => {
      totalLength += buf.length;
    });

    const result = new Uint8Array(totalLength);
    let offset = 0;
    buffers.forEach((buf) => {
      result.set(buf, offset);
      offset += buf.length;
    });

    return result;
  }

  /**
   * Encodes standard string text to a UTF-8/ASCII byte buffer.
   */
  private static encodeText(text: string): Uint8Array {
    return Buffer.from(text + '\n', 'utf8');
  }

  /**
   * Transforms pre-rendered string lines into full binary ESC/POS printer instructions.
   */
  public static format(lines: string[], kickDrawer: boolean = false): Uint8Array {
    const buffers: Uint8Array[] = [];

    // 1. Initialize printer
    buffers.push(this.CMD_INIT);

    // Optional Cash Drawer Kick at start of job
    if (kickDrawer) {
      buffers.push(this.CMD_DRAWER_KICK);
    }

    // 2. Loop through and format each line based on simple rules
    lines.forEach((line, index) => {
      // First line is assumed to be Store Name (Big + Centered)
      if (index === 0) {
        buffers.push(this.CMD_ALIGN_CENTER);
        buffers.push(this.CMD_SIZE_BIG);
        buffers.push(this.CMD_BOLD_ON);
        buffers.push(this.encodeText(line));
        buffers.push(this.CMD_SIZE_NORMAL);
        buffers.push(this.CMD_BOLD_OFF);
        return;
      }

      // Reprint markers are bolded and centered
      if (line.includes('*** REPRINT')) {
        buffers.push(this.CMD_ALIGN_CENTER);
        buffers.push(this.CMD_BOLD_ON);
        buffers.push(this.encodeText(line));
        buffers.push(this.CMD_BOLD_OFF);
        return;
      }

      // TOTAL lines are bolded
      if (line.startsWith('TOTAL:')) {
        buffers.push(this.CMD_ALIGN_LEFT);
        buffers.push(this.CMD_BOLD_ON);
        buffers.push(this.encodeText(line));
        buffers.push(this.CMD_BOLD_OFF);
        return;
      }

      // Footer greetings are centered
      if (line.includes('Thank you') || line.includes('شكراً')) {
        buffers.push(this.CMD_ALIGN_CENTER);
        buffers.push(this.encodeText(line));
        return;
      }

      // Default lines are left-aligned
      buffers.push(this.CMD_ALIGN_LEFT);
      buffers.push(this.encodeText(line));
    });

    // 3. Final spacing and cutting command
    buffers.push(new Uint8Array([0x0a, 0x0a, 0x0a])); // Feed 3 lines
    buffers.push(this.CMD_CUT);

    return this.concatBuffers(buffers);
  }
}
