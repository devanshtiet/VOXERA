import { pipeline, env, TextClassificationPipeline } from '@xenova/transformers';

// Configure environment for Node.js
env.allowLocalModels = true;
env.useBrowserCache = false;

class MLClassifier {
  static task = 'text-classification';
  static model = 'Xenova/distilbert-base-uncased-finetuned-sst-2-english';
  static instance: TextClassificationPipeline | null = null;

  static async getInstance(progress_callback?: (progress: any) => void): Promise<TextClassificationPipeline> {
    if (this.instance === null) {
      // @ts-ignore - transformers.js types are sometimes loose
      this.instance = (await pipeline(this.task, this.model, { 
        progress_callback 
      })) as TextClassificationPipeline;
    }
    return this.instance;
  }
}

export default MLClassifier;
