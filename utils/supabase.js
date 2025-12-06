import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

export const deleteFileFromUrl = async (fileUrl) => {
  if (!fileUrl) return;

  try {
    // Extract the file path from the public URL
    // Format: .../storage/v1/object/public/task-assets/FILENAME.png
    const pathParts = fileUrl.split('/task-assets/');
    if (pathParts.length < 2) return;
    
    const fileName = pathParts[1]; // Get everything after "task-assets/"

    const { error } = await supabase
      .storage
      .from('task-assets')
      .remove([fileName]);

    if (error) {
      console.error("Supabase Delete Error:", error.message);
    } else {
      console.log("🗑️ Deleted file from Supabase:", fileName);
    }
  } catch (err) {
    console.error("File deletion failed:", err);
  }
};