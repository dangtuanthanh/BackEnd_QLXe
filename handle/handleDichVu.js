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
/*Quản lý đăng kiểm */
// lấy danh sách đăng kiểm
async function getRegistry() {
  try {
    let result = await pool.request().query('EXEC service_getRegistry_getRegistry');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá đăng kiểm
async function deleteRegistry(ID, ID2) {
  try {
    await pool.request()
      .input('tableName', sql.VarChar, 'ChiTietDangKiem')
      .input('MaXe', sql.Int, ID)
      .input('col2', sql.VarChar, 'LanDangKiem')
      .input('value2', sql.Int, ID2)
      .execute('global_deleteService_deleteService');
  } catch (error) {
    throw error;
  }
}

//xử lý thêm đăng kiểm
async function insertRegistry(data) {
  try {
    // if (data.TinhTrangApDung =='true') {
    //   //nếu có áp dụng cái mới thì tắt áp dụng các cái cũ
    //   await pool.request()
    //     .input('tableName', sql.NVarChar, 'ChiTietDangKiem')
    //     .input('MaXe', sql.Int, data.MaXe)
    //     .execute('global_getOffService_getOffService');
    // }
    // lấy lần gần đây nhất
    const layLanGanDay = await pool.request()
      .input('tableName', sql.NVarChar, 'ChiTietDangKiem')
      .input('col2', sql.NVarChar, 'LanDangKiem')
      .input('MaXe', sql.Int, data.MaXe)
      .execute('global_getIndexService_getIndexService');
    const LanMoi = layLanGanDay.recordset.length
      ? layLanGanDay.recordset[0]['max'] + 1
      : 1;
    //thêm dữ liệu mới vào SQL
    await pool.request()
      .input('HinhAnh', sql.NVarChar, data.HinhAnh)
      .input('MaXe', sql.Int, data.MaXe)
      .input('LanDangKiem', sql.Int, LanMoi)
      .input('NgayDangKiem', sql.Date, data.NgayDangKiem)
      .input('ThoiGian', sql.Int, data.ThoiGian)
      .input('NoiDangKiem', sql.NVarChar, data.NoiDangKiem)
      .input('NguoiDiDangKiem', sql.NVarChar, data.NguoiDiDangKiem)
      // .input('TinhTrangApDung', sql.Bit, data.TinhTrangApDung=='true' ? true : (LanMoi == 1 ? true : false))
      .execute('service_insertRegistry_insertRegistry');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật đăng kiểm
async function updateRegistry(data) {
  try {
    // if (data.TinhTrangApDung =='true') {
    //   //nếu có áp dụng cái mới thì tắt áp dụng các cái cũ
    //   await pool.request()
    //     .input('tableName', sql.NVarChar, 'ChiTietDangKiem')
    //     .input('MaXe', sql.Int, data.MaXe)
    //     .execute('global_getOffService_getOffService');
    // }
    //cập nhật dữ liệu mới vào SQL
    await pool.request()
      .input('HinhAnh', sql.NVarChar, data.HinhAnh === 'null' ? null : data.HinhAnh)
      .input('MaXe', sql.Int, data.MaXe)
      .input('LanDangKiem', sql.Int, data.LanDangKiem)
      .input('NgayDangKiem', sql.Date, data.NgayDangKiem === 'null' ? null : data.NgayDangKiem)
      .input('ThoiGian', sql.Int, data.ThoiGian === 'null' ? null : data.ThoiGian)
      .input('NoiDangKiem', sql.NVarChar, data.NoiDangKiem === 'null' ? null : data.NoiDangKiem)
      .input('NguoiDiDangKiem', sql.NVarChar, data.NguoiDiDangKiem === 'null' ? null : data.NguoiDiDangKiem)
      // .input('TinhTrangApDung', sql.Bit, data.TinhTrangApDung=='true' ? true : false)
      .execute('service_updateRegistry_updateRegistry');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

/*Quản lý phù hiệu */
// lấy danh sách phù hiệu
async function getEmblem() {
  try {
    let result = await pool.request().query('EXEC service_getEmblem_getEmblem');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá phù hiệu
async function deleteEmblem(ID, ID2) {
  try {
    await pool.request()
      .input('tableName', sql.VarChar, 'ChiTietPhuHieu')
      .input('MaXe', sql.Int, ID)
      .input('col2', sql.VarChar, 'LanPhuHieu')
      .input('value2', sql.Int, ID2)
      .execute('global_deleteService_deleteService');
  } catch (error) {
    throw error;
  }
}

//xử lý thêm phù hiệu
async function insertEmblem(data) {
  try {
    // if (data.TinhTrangApDung =='true') {
    //   //nếu có áp dụng cái mới thì tắt áp dụng các cái cũ
    //   await pool.request()
    //     .input('tableName', sql.NVarChar, 'ChiTietPhuHieu')
    //     .input('MaXe', sql.Int, data.MaXe)
    //     .execute('global_getOffService_getOffService');
    // }
    // lấy lần gần đây nhất
    const layLanGanDay = await pool.request()
      .input('tableName', sql.NVarChar, 'ChiTietPhuHieu')
      .input('col2', sql.NVarChar, 'LanPhuHieu')
      .input('MaXe', sql.Int, data.MaXe)
      .execute('global_getIndexService_getIndexService');
    const LanMoi = layLanGanDay.recordset.length
      ? layLanGanDay.recordset[0]['max'] + 1
      : 1;
    //thêm dữ liệu mới vào SQL
    await pool.request()
      .input('HinhAnh', sql.NVarChar, data.HinhAnh)
      .input('MaXe', sql.Int, data.MaXe)
      .input('LanPhuHieu', sql.Int, LanMoi)
      .input('NgayCapPhuHieu', sql.Date, data.NgayCapPhuHieu)
      .input('ThoiGian', sql.Int, data.ThoiGian)
      .input('NoiCapPhuHieu', sql.NVarChar, data.NoiCapPhuHieu)
      .input('NguoiDiCapPhuHieu', sql.NVarChar, data.NguoiDiCapPhuHieu)
      //.input('TinhTrangApDung', sql.Bit, data.TinhTrangApDung=='true' ? true : (LanMoi == 1 ? true : false))
      .execute('service_insertEmblem_insertEmblem');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật phù hiệu
async function updateEmblem(data) {
  try {
    // if (data.TinhTrangApDung =='true') {
    //   //nếu có áp dụng cái mới thì tắt áp dụng các cái cũ
    //   await pool.request()
    //     .input('tableName', sql.NVarChar, 'ChiTietPhuHieu')
    //     .input('MaXe', sql.Int, data.MaXe)
    //     .execute('global_getOffService_getOffService');
    // }
    //cập nhật dữ liệu mới vào SQL
    await pool.request()
      .input('HinhAnh', sql.NVarChar, data.HinhAnh === 'null' ? null : data.HinhAnh)
      .input('MaXe', sql.Int, data.MaXe)
      .input('LanPhuHieu', sql.Int, data.LanPhuHieu)
      .input('NgayCapPhuHieu', sql.Date, data.NgayCapPhuHieu === 'null' ? null : data.NgayCapPhuHieu)
      .input('ThoiGian', sql.Int, data.ThoiGian === 'null' ? null : data.ThoiGian)
      .input('NoiCapPhuHieu', sql.NVarChar, data.NoiCapPhuHieu === 'null' ? null : data.NoiCapPhuHieu)
      .input('NguoiDiCapPhuHieu', sql.NVarChar, data.NguoiDiCapPhuHieu === 'null' ? null : data.NguoiDiCapPhuHieu)
      // .input('TinhTrangApDung', sql.Bit, data.TinhTrangApDung == 'true' ? true : false)
      .execute('service_updateEmblem_updateEmblem');
    return { success: true };
  } catch (error) {
    throw error;
  }
}


/*Quản lý bảo hiểm */
// lấy danh sách bảo hiểm
async function getInsurance() {
  try {
    let result = await pool.request().query('EXEC service_getInsurance_getInsurance');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá bảo hiểm
async function deleteInsurance(ID, ID2) {
  try {
    await pool.request()
      .input('tableName', sql.VarChar, 'ChiTietMuaBaoHiem')
      .input('MaXe', sql.Int, ID)
      .input('col2', sql.VarChar, 'LanMuaBaoHiem')
      .input('value2', sql.Int, ID2)
      .execute('global_deleteService_deleteService');
  } catch (error) {
    throw error;
  }
}

//xử lý thêm bảo hiểm
async function insertInsurance(data) {
  try {
    // if (data.TinhTrangApDung == 'true') {
    //   //nếu có áp dụng cái mới thì tắt áp dụng các cái cũ
    //   await pool.request()
    //     .input('tableName', sql.NVarChar, 'ChiTietMuaBaoHiem')
    //     .input('MaXe', sql.Int, data.MaXe)
    //     .execute('global_getOffService_getOffService');
    // }
    // lấy lần gần đây nhất
    const layLanGanDay = await pool.request()
      .input('tableName', sql.NVarChar, 'ChiTietMuaBaoHiem')
      .input('col2', sql.NVarChar, 'LanMuaBaoHiem')
      .input('MaXe', sql.Int, data.MaXe)
      .execute('global_getIndexService_getIndexService');
    const LanMoi = layLanGanDay.recordset.length
      ? layLanGanDay.recordset[0]['max'] + 1
      : 1;
    //thêm dữ liệu mới vào SQL
    await pool.request()
      .input('HinhAnh', sql.NVarChar, data.HinhAnh)
      .input('MaXe', sql.Int, data.MaXe)
      .input('LanMuaBaoHiem', sql.Int, LanMoi)
      .input('NgayMuaBaoHiem', sql.Date, data.NgayMuaBaoHiem)
      .input('ThoiGian', sql.Int, data.ThoiGian)
      .input('LoaiBaoHiem', sql.NVarChar, data.LoaiBaoHiem)
      .input('NguoiMuaBaoHiem', sql.NVarChar, data.NguoiMuaBaoHiem)
      // .input('TinhTrangApDung', sql.Bit, data.TinhTrangApDung == 'true' ? true : (LanMoi == 1 ? true : false))
      .execute('service_insertInsurance_insertInsurance');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật bảo hiểm
async function updateInsurance(data) {
  try {
    // if (data.TinhTrangApDung == 'true') {
    //   //nếu có áp dụng cái mới thì tắt áp dụng các cái cũ
    //   await pool.request()
    //     .input('tableName', sql.NVarChar, 'ChiTietMuaBaoHiem')
    //     .input('MaXe', sql.Int, data.MaXe)
    //     .execute('global_getOffService_getOffService');
    // }
    //cập nhật dữ liệu mới vào SQL

    await pool.request()
      .input('HinhAnh', sql.NVarChar, data.HinhAnh === 'null' ? null : data.HinhAnh)
      .input('MaXe', sql.Int, data.MaXe)
      .input('LanMuaBaoHiem', sql.Int, data.LanMuaBaoHiem)
      .input('NgayMuaBaoHiem', sql.Date, data.NgayMuaBaoHiem === 'null' ? null : data.NgayMuaBaoHiem)
      .input('ThoiGian', sql.Int, data.ThoiGian === 'null' ? null : data.ThoiGian)
      .input('LoaiBaoHiem', sql.NVarChar, data.LoaiBaoHiem === 'null' ? null : data.LoaiBaoHiem)
      .input('NguoiMuaBaoHiem', sql.NVarChar, data.NguoiMuaBaoHiem === 'null' ? null : data.NguoiMuaBaoHiem)
      // .input('TinhTrangApDung', sql.Bit, data.TinhTrangApDung == 'true' ? true : false)
      .execute('service_updateInsurance_updateInsurance');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

/*Quản lý định vị */
// lấy danh sách định vị
async function getLocate() {
  try {
    let result = await pool.request().query('EXEC service_getLocate_getLocate');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá định vị
async function deleteLocate(ID, ID2) {
  try {
    await pool.request()
      .input('tableName', sql.VarChar, 'ChiTietDinhVi')
      .input('MaXe', sql.Int, ID)
      .input('col2', sql.VarChar, 'LanMuaDinhVi')
      .input('value2', sql.Int, ID2)
      .execute('global_deleteService_deleteService');
  } catch (error) {
    throw error;
  }
}

//xử lý thêm định vị
async function insertLocate(data) {
  try {
    // if (data.TinhTrangApDung == 'true') {
    //   //nếu có áp dụng cái mới thì tắt áp dụng các cái cũ
    //   await pool.request()
    //     .input('tableName', sql.NVarChar, 'ChiTietDinhVi')
    //     .input('MaXe', sql.Int, data.MaXe)
    //     .execute('global_getOffService_getOffService');
    // }
    // lấy lần gần đây nhất
    const layLanGanDay = await pool.request()
      .input('tableName', sql.NVarChar, 'ChiTietDinhVi')
      .input('col2', sql.NVarChar, 'LanMuaDinhVi')
      .input('MaXe', sql.Int, data.MaXe)
      .execute('global_getIndexService_getIndexService');
    const LanMoi = layLanGanDay.recordset.length
      ? layLanGanDay.recordset[0]['max'] + 1
      : 1;
    //thêm dữ liệu mới vào SQL
    await pool.request()
      .input('HinhAnh', sql.NVarChar, data.HinhAnh)
      .input('MaXe', sql.Int, data.MaXe)
      .input('LanMuaDinhVi', sql.Int, LanMoi)
      .input('NgayMua', sql.Date, data.NgayMua)
      .input('ThoiGian', sql.Int, data.ThoiGian)
      .input('URLDinhVi', sql.NVarChar, data.URLDinhVi)
      .input('UserNameDinhVi', sql.VarChar, data.UserNameDinhVi)
      .input('MatKhauDinhVi', sql.VarChar, data.MatKhauDinhVi)
      .input('NguoiMuaDinhVi', sql.NVarChar, data.NguoiMuaDinhVi)
      // .input('TinhTrangApDung', sql.Bit, data.TinhTrangApDung == 'true' ? true : (LanMoi == 1 ? true : false))
      .execute('service_insertLocate_insertLocate');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật định vị
async function updateLocate(data) {
  try {
    // if (data.TinhTrangApDung == 'true') {
    //   //nếu có áp dụng cái mới thì tắt áp dụng các cái cũ
    //   await pool.request()
    //     .input('tableName', sql.NVarChar, 'ChiTietDinhVi')
    //     .input('MaXe', sql.Int, data.MaXe)
    //     .execute('global_getOffService_getOffService');
    // }
    //cập nhật dữ liệu mới vào SQL

    await pool.request()
    .input('HinhAnh', sql.NVarChar, data.HinhAnh=== 'null' ? null : data.HinhAnh)
      .input('MaXe', sql.Int, data.MaXe)
      .input('LanMuaDinhVi', sql.Int, data.LanMuaDinhVi)
      .input('NgayMua', sql.Date, data.NgayMua === 'null' ? null : data.NgayMua)
      .input('ThoiGian', sql.Int, data.ThoiGian === 'null' ? null : data.ThoiGian)
      .input('URLDinhVi', sql.NVarChar, data.URLDinhVi === 'null' ? null : data.URLDinhVi)
      .input('UserNameDinhVi', sql.VarChar, data.UserNameDinhVi === 'null' ? null : data.UserNameDinhVi)
      .input('MatKhauDinhVi', sql.VarChar, data.MatKhauDinhVi === 'null' ? null : data.MatKhauDinhVi)
      .input('NguoiMuaDinhVi', sql.NVarChar, data.NguoiMuaDinhVi === 'null' ? null : data.NguoiMuaDinhVi)
      // .input('TinhTrangApDung', sql.Bit, data.TinhTrangApDung == 'true' ? true : false)
      .execute('service_updateLocate_updateLocate');
    return { success: true };
  } catch (error) {
    throw error;
  }
}
module.exports = {
  checkSessionAndRole: checkSessionAndRole,
  getRegistry: getRegistry,
  updateRegistry: updateRegistry,
  insertRegistry: insertRegistry,
  deleteRegistry: deleteRegistry,

  getEmblem: getEmblem,
  deleteEmblem: deleteEmblem,
  insertEmblem: insertEmblem,
  updateEmblem: updateEmblem,

  getInsurance: getInsurance,
  deleteInsurance: deleteInsurance,
  insertInsurance: insertInsurance,
  updateInsurance: updateInsurance,

  getLocate: getLocate,
  deleteLocate: deleteLocate,
  insertLocate: insertLocate,
  updateLocate: updateLocate
};
