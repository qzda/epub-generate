import chardet from "chardet";
import {
  DEFAULT_ENCODING,
  normalizeEncodingName,
} from "../domain/encoding";
import type { TextEncoding } from "../domain/encoding";
import { ENCODING_SNIFF_SIZE } from "../config/limits";
import { assertNotAborted } from "./abort";

export type EncodingDetector = (bytes: Uint8Array) => string | null;

export interface EncodingDetection {
  encoding: TextEncoding;
  detected: string | null;
  /** 检测结果不可用，已回退到默认编码。 */
  fallback: boolean;
}

export interface DetectEncodingOptions {
  sniffSize?: number;
  signal?: AbortSignal;
  detector?: EncodingDetector;
}

export async function detectTextEncoding(
  blob: Blob,
  options: DetectEncodingOptions = {}
): Promise<EncodingDetection> {
  assertNotAborted(options.signal);

  const sniffSize = Math.max(0, options.sniffSize ?? ENCODING_SNIFF_SIZE);
  const sample = new Uint8Array(
    await blob.slice(0, sniffSize).arrayBuffer()
  );
  assertNotAborted(options.signal);

  if (sample.length === 0) {
    return {
      encoding: DEFAULT_ENCODING,
      detected: null,
      fallback: false,
    };
  }

  const detector = options.detector ?? chardet.detect;
  const detected = detector(sample);
  const normalized = detected ? normalizeEncodingName(detected) : undefined;

  if (!normalized) {
    return {
      encoding: DEFAULT_ENCODING,
      detected,
      fallback: true,
    };
  }

  return {
    encoding: normalized,
    detected,
    fallback: false,
  };
}
