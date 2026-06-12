import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/**
 * 导出页面或特定 DOM 元素为 PDF
 * @param elementId 要导出的 DOM 元素的 ID (例如 "report-content")
 * @param filename 导出的文件名
 */
export async function exportToPDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return false;
  }

  try {
    // 创建一个临时的克隆节点，以便我们在渲染前对其进行修改（如移除滚动条、展开所有内容等）
    // 为了简单起见，这里直接对原节点进行截图
    const canvas = await html2canvas(element, {
      scale: 2, // 提高清晰度
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/jpeg", 1.0);
    
    // A4 尺寸 (210 x 297 mm)
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    // 处理多页逻辑
    let heightLeft = pdfHeight;
    let position = 0;
    const pageHeight = pdf.internal.pageSize.getHeight();

    // 第一页
    pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;

    // 后续页面
    while (heightLeft > 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
    return true;
  } catch (error) {
    console.error("PDF generation failed:", error);
    return false;
  }
}
