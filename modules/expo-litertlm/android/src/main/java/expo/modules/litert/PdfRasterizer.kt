package expo.modules.litert

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import kotlin.math.min

object PdfRasterizer {
  fun rasterizePdfToJpegPages(context: Context, pdfPath: String, maxPages: Int): List<String> {
    val source = File(pdfPath)
    if (!source.exists()) {
      throw IllegalArgumentException("PDF file not found at: $pdfPath")
    }

    val outputUris = mutableListOf<String>()

    ParcelFileDescriptor.open(source, ParcelFileDescriptor.MODE_READ_ONLY).use { pfd ->
      PdfRenderer(pfd).use { renderer ->
        val pages = min(renderer.pageCount, maxPages)

        for (index in 0 until pages) {
          renderer.openPage(index).use { page ->
            val width = page.width.coerceAtLeast(1)
            val height = page.height.coerceAtLeast(1)
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            canvas.drawColor(Color.WHITE)

            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)

            val outputFile = File(
              context.cacheDir,
              "litert_pdf_${System.currentTimeMillis()}_${index}_${UUID.randomUUID()}.jpg"
            )

            FileOutputStream(outputFile).use { output ->
              bitmap.compress(Bitmap.CompressFormat.JPEG, 95, output)
              output.flush()
            }

            bitmap.recycle()
            outputUris.add("file://${outputFile.absolutePath}")
          }
        }
      }
    }

    return outputUris
  }
}
