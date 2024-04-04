const db = require('../dbconfig');
const pool = db.getPool();
const sql = require('mssql');
//Kiểm tra phiên và quyền đăng nhập
async function checkSessionAndRole(ss, permission) {
  try {
    let result = await pool
      .request()
      .input("MaDangNhap", sql.NVarChar, ss)
      .query('EXEC loginAndPermission_checkSessionAndRole_getInfoByMaDangNhap @MaDangNhap');

    // .query(`SELECT IDNhanVien, HanDangNhap FROM NhanVien WHERE MaDangNhap = @MaDangNhap AND NhanVien.DaXoa = 0`);
    if (result.recordset.length === 0) {
      console.log("Không tìm thấy người dùng với mã đăng nhập:", ss);
      return false;
    } else {
      const timeSession = result.recordset[0].HanDangNhap;
      const currentTime = new Date();
      if (currentTime > timeSession) {
        console.log("Thời gian đăng nhập đã hết hạn:", ss);
        return false;
      } else {
        //Kiểm tra vai trò
        let resultVaiTro = await pool
          .request()
          .input('MaThanhVien', sql.Int, result.recordset[0].MaThanhVien)
          .query('EXEC loginAndPermission_checkSessionAndRole_getPermissionByMaThanhVien @MaThanhVien');
        const permissions = resultVaiTro.recordset.map((row) => row.TenQuyen);;
        for (const p of permissions) {
          if (p === permission) {
            console.log('Có quyền truy cập');
            return true; // Nếu tìm thấy quyền khớp với biến permission, trả về true
          }
        }
        console.log('Không có quyền truy cập');
        return false; // Nếu không tìm thấy quyền nào khớp với biến permission, trả về false
      }
    }
  } catch (error) {
    console.error("Lỗi khi kiểm tra phiên và vai trò:", error);
    throw error;
  }
}
//xử lý lấy tổng số xe
async function getTotalCar() {
  try {
    let result = await pool.request().query('EXEC dashboard_getTotalCar');
    return result.recordset.length;
  } catch (error) {
    throw error;
  }
}
//xử lý lấy tổng thành viên
async function getTotalMember() {
  try {
    let result = await pool.request().query('EXEC dashboard_getTotalMember');
    return result.recordset.length;
  } catch (error) {
    throw error;
  }
}

//xử lý lấy số lượng hợp đồng năm nay
async function getYearContract() {
  try {
    // Lấy ngày hiện tại
    const date = new Date();
    const year = date.getFullYear();
    let result = await pool.request()
      .input('year', sql.Int, year)
      .query('EXEC dashboard_getYearContract @year');
    return result.recordset[0].CountContract;
  } catch (error) {
    throw error;
  }
}

//xử lý lấy doanh thu năm nay
async function getRevenueYear() {
  try {
    // Lấy ngày hiện tại
    const date = new Date();
    const year = date.getFullYear();
    let result = await pool.request()
      .input('year', sql.Int, year)
      .query('EXEC dashboard_getRevenueYear @year');
    return result.recordset[0].RevenueYear;
  } catch (error) {
    throw error;
  }
}

//xử lý lấy số lượng doanh thu tháng
async function getListRevenueYear(oldYear, year) {
  try {
    const resultOldYear = await pool.request()
      .input('year', sql.Int, oldYear)
      .execute('dashboard_getListRevenueYear');
    const resultYear = await pool.request()
      .input('year', sql.Int, year)
      .execute('dashboard_getListRevenueYear');
    const dataOldYear = formatData(resultOldYear.recordset);
    const dataYear = formatData(resultYear.recordset);
    return {
      oldYear: dataOldYear,
      year: dataYear
    }
  } catch (error) {
    throw error;
  }
}
// function getDaysInMonth(month, year) {
//   return Array.from(
//     {length: new Date(year, month, 0).getDate()}, 
//     (_, i) => i + 1
//   );
// }
function formatData(records) {
  const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  let processedData = [];

  months.forEach(month => {
    let record = records.find(r => {
      return r.Month === month;
    });

    if (record) {
      processedData.push({
        Month: month,
        Revenue: record.Revenue
      });
    } else {
      processedData.push({
        Month: month,
        Revenue: 0
      });
    }
  });

  return processedData;
}
module.exports = {
  checkSessionAndRole: checkSessionAndRole,
  getTotalCar: getTotalCar,
  getTotalMember: getTotalMember,
  getYearContract: getYearContract,
  getRevenueYear: getRevenueYear,

  getListRevenueYear: getListRevenueYear
};