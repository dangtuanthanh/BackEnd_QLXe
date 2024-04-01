const db = require('../dbconfig');
const pool = db.getPool();
const sql = require('mssql');
const { format } = require('date-fns'); //ép định dạng cho ngày tháng năm
const bcrypt = require('bcrypt'); // dùng để mã hoá mật khẩu và tạo mã phiên đăng nhập
const nodemailer = require('nodemailer');//dùng để gửi email

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
/*Quản lý tình trạng xe */
// lấy danh sách tình trạng xe
async function getStatusCar() {
  try {
    let result = await pool.request().query('EXEC car_getStatusCar_getStatusCar');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá tình trạng xe
async function deleteStatusCar(ID) {
  try {
    await pool.request()
      .input('MaTinhTrangXe', sql.Int, ID)
      .execute('car_deleteStatusCar_deleteStatusCar');
  } catch (error) {
    throw error;
  }
}

//xử lý thêm tình trạng xe
async function insertStatusCar(data) {
  try {
    await pool.request()
      .input('MoTa', sql.NVarChar, data.MoTa)
      .execute('car_insertStatusCar_insertStatusCar');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật tình trạng xe
async function updateStatusCar(data) {
  try {
    await pool.request()
      .input('MaTinhTrangXe', sql.Int, data.MaTinhTrangXe)
      .input('MoTa', sql.NVarChar, data.MoTa)
      .execute('car_updateStatusCar_updateStatusCar');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

/*Quản lý nhóm loại xe */
// lấy danh sách nhóm loại xe
async function getGroupTypeCar() {
  try {
    let result = await pool.request().query('EXEC car_getGroupTypeCar_getGroupTypeCar');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá nhóm loại xe
async function deleteGroupTypeCar(ID) {
  try {
    await pool.request()
      .input('MaNhomLoaiXe', sql.Int, ID)
      .execute('car_deleteGroupTypeCar_deleteGroupTypeCar');
  } catch (error) {
    throw error;
  }
}

//xử lý thêm nhóm loại xe
async function insertGroupTypeCar(data) {
  try {
    await pool.request()
      .input('TenNhomLoaiXe', sql.NVarChar, data.TenNhomLoaiXe)
      .input('MoTa', sql.NVarChar, data.MoTa)
      .execute('car_insertGroupTypeCar_insertGroupTypeCar');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật nhóm loại xe
async function updateGroupTypeCar(data) {
  try {
    await pool.request()
      .input('MaNhomLoaiXe', sql.Int, data.MaNhomLoaiXe)
      .input('TenNhomLoaiXe', sql.NVarChar, data.TenNhomLoaiXe)
      .input('MoTa', sql.NVarChar, data.MoTa)
      .execute('car_updateGroupTypeCar_updateGroupTypeCar');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

/*Quản lý loại xe */
// lấy danh sách loại xe
async function getTypeCar() {
  try {
    let result = await pool.request().query('EXEC car_getTypeCar_getTypeCar');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá loại xe
async function deleteTypeCar(ID) {
  try {
    await pool.request()
      .input('MaLoaiXe', sql.Int, ID)
      .execute('car_deleteTypeCar_deleteTypeCar');
  } catch (error) {
    throw error;
  }
}

//xử lý thêm loại xe
async function insertTypeCar(data) {
  try {
    await pool.request()
      .input('TenLoaiXe', sql.NVarChar, data.TenLoaiXe)
      .input('MaNhomLoaiXe', sql.Int, data.MaNhomLoaiXe)
      .input('MoTa', sql.NVarChar, data.MoTa)
      .execute('car_insertTypeCar_insertTypeCar');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật loại xe
async function updateTypeCar(data) {
  try {
    await pool.request()
      .input('MaLoaiXe', sql.Int, data.MaLoaiXe)
      .input('TenLoaiXe', sql.NVarChar, data.TenLoaiXe)
      .input('MaNhomLoaiXe', sql.Int, data.MaNhomLoaiXe)
      .input('MoTa', sql.NVarChar, data.MoTa)
      .execute('car_updateTypeCar_updateTypeCar');
    return { success: true };
  } catch (error) {
    throw error;
  }
}


/*Quản lý xe */
// lấy danh sách xe
async function getCar() {
  try {
    let result = await pool.request().query('EXEC car_getCar_getCar');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá xe
async function deleteCar(ID) {
  try {
    await pool.request()
      .input('MaXe', sql.Int, ID)
      .execute('car_deleteCar_deleteCar');
  } catch (error) {
    throw error;
  }
}

//xử lý thêm xe
async function insertCar(data) {
  try {
    await pool.request()
      .input('BienSoXe', sql.VarChar, data.BienSoXe)
      .input('NhanHieu', sql.NVarChar, data.NhanHieu)
      .input('TrongTai', sql.NVarChar, data.TrongTai)
      .input('NamSanXuat', sql.Int, data.NamSanXuat)
      .input('NgayMua', sql.Date, data.NgayMua)
      .input('Mau', sql.NVarChar, data.Mau)
      .input('MoTa', sql.NVarChar, data.MoTa)
      .input('LinhKien', sql.NVarChar, data.LinhKien)
      .input('MaTinhTrangXe', sql.Int, data.MaTinhTrangXe)
      .input('MaLoaiXe', sql.Int, data.MaLoaiXe)
      .input('HinhAnh', sql.NVarChar, data.HinhAnh)
      .input('HinhAnh2', sql.NVarChar, data.HinhAnh2)
      .input('HinhAnh3', sql.NVarChar, data.HinhAnh3)
      .input('HinhAnh4', sql.NVarChar, data.HinhAnh4)
      .execute('car_insertCar_insertCar');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật xe
async function updateCar(data) {
  try {
    await pool.request()
      .input('MaXe', sql.Int, data.MaXe)
      .input('BienSoXe', sql.VarChar, data.BienSoXe)
      .input('NhanHieu', sql.NVarChar, data.NhanHieu === 'null' ? null : data.NhanHieu)
      .input('TrongTai', sql.NVarChar, data.TrongTai === 'null' ? null : data.TrongTai)
      .input('NamSanXuat', sql.Int, data.NamSanXuat === 'null' ? null : data.NamSanXuat)
      .input('NgayMua', sql.Date, data.NgayMua === 'null' ? null : data.NgayMua)
      .input('Mau', sql.NVarChar, data.Mau === 'null' ? null : data.Mau)
      .input('MoTa', sql.NVarChar, data.MoTa === 'null' ? null : data.MoTa)
      .input('LinhKien', sql.NVarChar, data.LinhKien === 'null' ? null : data.LinhKien)
      .input('MaTinhTrangXe', sql.Int, data.MaTinhTrangXe)
      .input('MaLoaiXe', sql.Int, data.MaLoaiXe)
      .input('HinhAnh', sql.NVarChar, data.HinhAnh)
      .input('HinhAnh2', sql.NVarChar, data.HinhAnh2)
      .input('HinhAnh3', sql.NVarChar, data.HinhAnh3)
      .input('HinhAnh4', sql.NVarChar, data.HinhAnh4)
      .execute('car_updateCar_updateCar');
    return { success: true };
  } catch (error) {
    throw error;
  }
}
async function getServiceByIDCar(MaXe, TenBang, Cot1, Cot2, Cot3) {
  try {
    let result = await pool.request()
      .input('MaXe', sql.Int, MaXe)
      .input('TenBang', sql.VarChar, TenBang)
      .input('Cot1', sql.VarChar, Cot1)
      .input('Cot2', sql.VarChar, Cot2)
      .input('Cot3', sql.VarChar, Cot3)
      .execute('global_getServicebyIDCar_getServiceByIDCar');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
async function getDetailContractByIDCar(MaXe) {
  try {
    let result = await pool.request()
      .input('MaXe', sql.Int, MaXe)
      .execute('car_getCar_getDetailContractByIDCar');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}

/*Quản lý hạng mục bảo dưỡng */
// lấy danh sách hạng mục bảo dưỡng
async function getMaintenanceItem() {
  try {
    let result = await pool.request().query('EXEC car_getMaintenanceItem_getMaintenanceItem');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá hạng mục bảo dưỡng
async function deleteMaintenanceItem(ID) {
  try {
    await pool.request()
      .input('ID', sql.Int, ID)
      .execute('car_deleteMaintenanceItem_deleteMaintenanceItem');
  } catch (error) {
    throw error;
  }
}

//xử lý thêm hạng mục bảo dưỡng
async function insertMaintenanceItem(data) {
  try {
    await pool.request()
      .input('TenHangMuc', sql.NVarChar, data.TenHangMuc)
      .input('MoTa', sql.NVarChar, data.MoTa)
      .execute('car_insertMaintenanceItem_insertMaintenanceItem');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật hạng mục bảo dưỡng
async function updateMaintenanceItem(data) {
  try {
    await pool.request()
      .input('MaHangMucBaoDuong', sql.Int, data.MaHangMucBaoDuong)
      .input('TenHangMuc', sql.NVarChar, data.TenHangMuc)
      .input('MoTa', sql.NVarChar, data.MoTa)
      .execute('car_updateMaintenanceItem_updateMaintenanceItem');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

/*Quản lý bảo dưỡng */
// lấy danh sách bảo dưỡng
async function getMaintenance() {
  try {
    let result = await pool.request().query('EXEC car_getMaintenance_getMaintenance');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá bảo dưỡng
async function deleteMaintenance(ID, ID2) {
  try {
    await pool.request()
      .input('tableName', sql.VarChar, 'ChiTietBaoDuong')
      .input('MaXe', sql.Int, ID)
      .input('col2', sql.VarChar, 'LanBaoDuong')
      .input('value2', sql.Int, ID2)
      .execute('global_deleteService_deleteService');
  } catch (error) {
    throw error;
  }
}

//xử lý thêm bảo dưỡng
async function insertMaintenance(data) {
  try {
    // lấy lần gần đây nhất
    const layLanGanDay = await pool.request()
      .input('tableName', sql.NVarChar, 'ChiTietBaoDuong')
      .input('col2', sql.NVarChar, 'LanBaoDuong')
      .input('MaXe', sql.Int, data.MaXe)
      .execute('global_getIndexService_getIndexService');
    const LanMoi = layLanGanDay.recordset.length
      ? layLanGanDay.recordset[0]['max'] + 1
      : 1;
    //thêm dữ liệu mới vào SQL
    await pool.request()
      .input('HinhAnh', sql.NVarChar, data.HinhAnh)
      .input('MaXe', sql.Int, data.MaXe)
      .input('LanBaoDuong', sql.Int, LanMoi)
      .input('MaHangMucBaoDuong', sql.Int, data.MaHangMucBaoDuong)
      .input('NgayBaoDuong', sql.Date, data.NgayBaoDuong)
      .input('ThoiGian', sql.Int, data.ThoiGian)
      .input('NguoiDiBaoDuong', sql.NVarChar, data.NguoiDiBaoDuong)
      .input('GhiChu', sql.NVarChar, data.GhiChu)
      .execute('car_insertMaintenance_insertMaintenance');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật bảo dưỡng
async function updateMaintenance(data) {
  try {
    //cập nhật dữ liệu mới vào SQL

    await pool.request()
      .input('HinhAnh', sql.NVarChar, data.HinhAnh)
      .input('MaXe', sql.Int, data.MaXe)
      .input('LanBaoDuong', sql.Int, data.LanBaoDuong)
      .input('MaHangMucBaoDuong', sql.Int, data.MaHangMucBaoDuong === 'null' ? null : data.MaHangMucBaoDuong)
      .input('NgayBaoDuong', sql.Date, data.NgayBaoDuong === 'null' ? null : data.NgayBaoDuong)
      .input('ThoiGian', sql.Int, data.ThoiGian === 'null' ? null : data.ThoiGian)
      .input('NguoiDiBaoDuong', sql.NVarChar, data.NguoiDiBaoDuong === 'null' ? null : data.NguoiDiBaoDuong)
      .input('GhiChu', sql.NVarChar, data.GhiChu === 'null' ? null : data.GhiChu)
      .execute('car_updateMaintenance_updateMaintenance');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

/*Quản lý lịch sử sử dụng */
// lấy danh sách lịch sử sử dụng
async function getUsageHistory() {
  try {
    let result = await pool.request().query('EXEC car_getUsageHistory_getUsageHistory');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá lịch sử sử dụng
async function deleteUsageHistory(ID, ID2) {
  try {
    await pool.request()
      .input('tableName', sql.VarChar, 'ChiTietSuDung')
      .input('MaXe', sql.Int, ID)
      .input('col2', sql.VarChar, 'LanSuDung')
      .input('value2', sql.Int, ID2)
      .execute('global_deleteService_deleteService');
  } catch (error) {
    throw error;
  }
}

//xử lý thêm lịch sử sử dụng
async function insertUsageHistory(data) {
  try {
    // lấy lần gần đây nhất
    const layLanGanDay = await pool.request()
      .input('tableName', sql.NVarChar, 'ChiTietSuDung')
      .input('col2', sql.NVarChar, 'LanSuDung')
      .input('MaXe', sql.Int, data.MaXe)
      .execute('global_getIndexService_getIndexService');
    const LanMoi = layLanGanDay.recordset.length
      ? layLanGanDay.recordset[0]['max'] + 1
      : 1;
    //thêm dữ liệu mới vào SQL
    await pool.request()
      .input('MaXe', sql.Int, data.MaXe)
      .input('LanSuDung', sql.Int, LanMoi)
      .input('NgayDi', sql.Date, data.NgayDi)
      .input('ThoiGian', sql.Int, data.ThoiGian)
      .input('KhoangCach', sql.VarChar, data.KhoangCach)
      .input('NguoiSuDung', sql.NVarChar, data.NguoiSuDung)
      .input('MucDich', sql.NVarChar, data.MucDich)
      .execute('car_insertUsageHistory_insertUsageHistory');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật lịch sử sử dụng
async function updateUsageHistory(data) {
  try {
    //cập nhật dữ liệu mới vào SQL
    await pool.request()
      .input('MaXe', sql.Int, data.MaXe)
      .input('LanSuDung', sql.Int, data.LanSuDung)
      .input('NgayDi', sql.Date, data.NgayDi)
      .input('ThoiGian', sql.Int, data.ThoiGian)
      .input('KhoangCach', sql.VarChar, data.KhoangCach)
      .input('NguoiSuDung', sql.NVarChar, data.NguoiSuDung)
      .input('MucDich', sql.NVarChar, data.MucDich)
      .execute('car_updateUsageHistory_updateUsageHistory');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

module.exports = {
  checkSessionAndRole: checkSessionAndRole,
  getStatusCar: getStatusCar,
  updateStatusCar: updateStatusCar,
  insertStatusCar: insertStatusCar,
  deleteStatusCar: deleteStatusCar,
  getGroupTypeCar: getGroupTypeCar,
  deleteGroupTypeCar: deleteGroupTypeCar,
  insertGroupTypeCar: insertGroupTypeCar,
  updateGroupTypeCar: updateGroupTypeCar,
  getTypeCar: getTypeCar,
  deleteTypeCar: deleteTypeCar,
  insertTypeCar: insertTypeCar,
  updateTypeCar: updateTypeCar,
  getCar: getCar,
  deleteCar: deleteCar,
  insertCar: insertCar,
  updateCar: updateCar,
  getServiceByIDCar: getServiceByIDCar,

  getMaintenanceItem: getMaintenanceItem,
  deleteMaintenanceItem: deleteMaintenanceItem,
  insertMaintenanceItem: insertMaintenanceItem,
  updateMaintenanceItem: updateMaintenanceItem,

  getMaintenance: getMaintenance,
  deleteMaintenance: deleteMaintenance,
  insertMaintenance: insertMaintenance,
  updateMaintenance: updateMaintenance,

  getUsageHistory: getUsageHistory,
  deleteUsageHistory: deleteUsageHistory,
  insertUsageHistory: insertUsageHistory,
  updateUsageHistory: updateUsageHistory,

  getDetailContractByIDCar:getDetailContractByIDCar
};
