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
/*Quản lý chủ đề */
// lấy danh sách chủ đề
async function getTopic() {
  try {
    let result = await pool.request().query('EXEC news_getTopic_getTopic');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá chủ đề
async function deleteTopic(ID) {
  try {
    await pool.request()
      .input('ID', sql.Int, ID)
      .execute('news_deleteTopic_deleteTopic');
  } catch (error) {
    throw error;
  }
}

//xử lý thêm chủ đề
async function insertTopic(data) {
  try {
    await pool.request()
      .input('TenChuDe', sql.NVarChar, data.TenChuDe)
      .input('MoTa', sql.NVarChar, data.MoTa)
      .execute('news_insertTopic_insertTopic');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật chủ đề
async function updateTopic(data) {
  try {
    await pool.request()
      .input('MaChuDe', sql.Int, data.MaChuDe)
      .input('TenChuDe', sql.NVarChar, data.TenChuDe)
      .input('MoTa', sql.NVarChar, data.MoTa)
      .execute('news_updateTopic_updateTopic');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

// lấy danh sách bài viết
async function getPost() {
  try {
    let result = await pool.request().query('EXEC news_getPost_getPost');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
// lấy danh sách file của 1 bài viết
async function getFiles() {
  try {
    const result =await pool.request()
      .input('ID', sql.Int, ID)
      .execute('news_getPost_getFiles');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//Hàm xoá bài viết
async function deletePost(ID) {
  try {
    await pool.request()
      .input('MaDangTin', sql.Int, ID)
      .execute('news_deletePost_deletePost');
  } catch (error) {
    throw error;
  }
}
async function insertPost(data) {
  try {
    console.log('data',data);
    const NgayDang = new Date();
    await pool.request()
      .input('TieuDe', sql.NVarChar, data.TieuDe)
      .input('NoiDung', sql.NVarChar, data.NoiDung)
      .input('NgayDang', sql.Date, NgayDang)
      .input('MaChuDe', sql.Int, data.MaChuDe)
      .input('MaThanhVien', sql.Int, data.MaThanhVien)
      .input('Tep', sql.NVarChar, data.Tep)
      .input('Tep2', sql.NVarChar, data.Tep2)
      .input('Tep3', sql.NVarChar, data.Tep3)
      .input('Tep4', sql.NVarChar, data.Tep4)
      .execute('post_insertPost_insertPost');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật xe
async function updatePost(data) {
  try {
    await pool.request()
      .input('MaDangTin', sql.Int, data.MaDangTin)
      .input('TieuDe', sql.NVarChar, data.TieuDe)
      .input('NoiDung', sql.NVarChar, data.NoiDung)
      .input('NgayDang', sql.Date, data.NgayDang)
      .input('MaChuDe', sql.Int, data.MaChuDe === 'null' ? null : data.MaChuDe)
      .input('MaThanhVien', sql.Int, data.MaThanhVien)
      .input('Tep', sql.NVarChar, data.Tep)
      .input('Tep2', sql.NVarChar, data.Tep2)
      .input('Tep3', sql.NVarChar, data.Tep3)
      .input('Tep4', sql.NVarChar, data.Tep4)
      .execute('post_updatePost_updatePost');
    return { success: true };
  } catch (error) {
    throw error;
  }
}
module.exports = {
  checkSessionAndRole: checkSessionAndRole,
  getTopic: getTopic,
  deleteTopic: deleteTopic,
  insertTopic: insertTopic,
  updateTopic: updateTopic,
  getPost: getPost,
  deletePost: deletePost,
  insertPost: insertPost,
  updatePost: updatePost,
  getFiles:getFiles
};
