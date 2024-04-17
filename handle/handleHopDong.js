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
/*Quản lý hợp đồng */
// lấy danh sách hợp đồng
async function getContract() {
  try {
    let result = await pool.request().query('EXEC contract_getContract_getContract');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}

//xử lý lấy danh sách chi tiết định mức theo IDSanPham
async function getListNormDetailsByID(ID) {
  try {
    const result = await pool.request()
      .input('ID', sql.Int, ID)
      .execute('contract_getContract_getListNormDetailsByID');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}

//Hàm xoá hợp đồng
async function deleteContract(ID) {
  try {
    await pool.request()
      .input('ID', sql.Int, ID)
      .execute('contract_deleteContract_deleteContract');
  } catch (error) {
    throw error;
  }
}

//xử lý thêm hợp đồng
async function insertContract(data) {
  try {
    //await updateTinhTrangApDung(data.TinhTrangApDung, MaHopDong)
    const TongTien = data.DanhSach.reduce((sum, item) => {
      return sum + Number(item.DonGia);
    }, 0)
    console.log('TongTien', TongTien);
    const result = await pool.request()
      .input('NgayLamHopDong', sql.Date, data.NgayLamHopDong)
      .input('ThoiGian', sql.Int, data.ThoiGian)
      .input('MaThanhVien', sql.Int, data.MaThanhVien)
      .input('SoHopDong', sql.VarChar, data.SoHopDong)
      .input('TongTien', sql.Int, TongTien)
      .execute('contract_insertContract_insertContract')
    const MaHopDong = result.recordset[0][''];
    // const danhSachObj = JSON.parse(data.DanhSach);

    await insertNormDetails(MaHopDong, data.DanhSach);
  } catch (error) {
    throw error;
  }
}
// async function updateTinhTrangApDung(TinhTrangApDung, MaHopDong) {
//   try {
//     if (TinhTrangApDung == true) {
//       //nếu có áp dụng cái mới thì tắt áp dụng các cái cũ
//       await pool.request()
//         .input('MaHopDong', sql.Int, MaHopDong)
//         .execute('contract_insertContract_updateTinhTrangApDung');
//     }
//   } catch (error) {
//     throw error;
//   }
// }
async function insertNormDetails(MaHopDong, DanhSach) {
  try {
    for (let item of DanhSach) {
      await pool.request()
        .input('MaHopDong', sql.Int, MaHopDong)
        .input('MaXe', sql.Int, item.MaXe)
        .input('NgayKiHopDong', sql.Date, item.NgayKiHopDong)
        .input('ThoiGian', sql.Int, item.ThoiGian)
        .input('DonGia', sql.Int, item.DonGia)
        .execute('contract_insertContract_insertNormDetails');
    }
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật hợp đồng
async function updateContract(data) {
  try {
    const TongTien = data.DanhSach.reduce((sum, item) => {
      return sum + Number(item.DonGia);
    }, 0)
    await pool.request()
      .input('MaHopDong', sql.Int, data.MaHopDong)
      .input('NgayLamHopDong', sql.Date, data.NgayLamHopDong)
      .input('ThoiGian', sql.Int, data.ThoiGian)
      .input('MaThanhVien', sql.Int, data.MaThanhVien)
      .input('SoHopDong', sql.VarChar, data.SoHopDong)
      .input('TongTien', sql.Int, TongTien)
      .execute('contract_updateContract_updateContract');
    // const danhSachObj = JSON.parse(data.DanhSach);
    const result = await Promise.all(
      data.DanhSach.map(async (item) => {
        const oldDetail = await getNormDetailsByID(data.MaHopDong, item.MaXe)
        if (oldDetail.length > 0)
          // Có thì cập nhật
          await updateNormDetails(data.MaHopDong, item)
        else
          // Không có thì thêm
          await insertNormDetails2(data.MaHopDong, item)
      })
    );

    // Kiểm tra danh sách người dùng truyền vào
    const newList = await getListNormDetailsByID(data.MaHopDong)
    // Xoá các hàng dữ liệu không có trong danh sách người dùng truyền vào
    const idField = 'MaXe'
    const deleteList = newList.filter(item =>
      !data.DanhSach.find(detail =>
        detail[idField] === item[idField]
      )
    );

    // Xóa các item trong deleteList
    for (const item of deleteList) {
      await deleteNormDetails(data.MaHopDong, item.MaXe)
    }
    return { success: true, message: "Sửa Dữ Liệu Thành Công!" };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

async function insertNormDetails2(MaHopDong, item) {
  try {
    await pool.request()
      .input('MaHopDong', sql.Int, MaHopDong)
      .input('MaXe', sql.Int, item.MaXe)
      .input('NgayKiHopDong', sql.Date, item.NgayKiHopDong)
      .input('ThoiGian', sql.Int, item.ThoiGian)
      .input('DonGia', sql.Int, item.DonGia)
      .execute('contract_insertContract_insertNormDetails');

  } catch (error) {
    throw error;
  }
}
// lấy chi tiết theo ID
async function getNormDetailsByID(MaHopDong, MaXe) {
  try {
    let result = await pool.request()
      .input('MaHopDong', sql.Int, MaHopDong)
      .input('MaXe', sql.Int, MaXe)
      .execute('contract_updateContract_getNormDetailsByID');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}

//hàm cập nhật chi tiết 
async function updateNormDetails(MaHopDong, item) {
  try {
    await pool.request()
      .input('MaHopDong', sql.Int, MaHopDong)
      .input('MaXe', sql.Int, item.MaXe)
      .input('NgayKiHopDong', sql.Date, item.NgayKiHopDong)
      .input('ThoiGian', sql.Int, item.ThoiGian)
      .input('DonGia', sql.Int, item.DonGia)
      .execute('contract_updateContract_updateNormDetails');
  } catch (error) {
    throw error;
  }
}
//hàm xoá chi tiết
async function deleteNormDetails(MaHopDong, MaXe) {
  try {
    await pool.request()
      .input('MaHopDong', sql.Int, MaHopDong)
      .input('MaXe', sql.Int, MaXe)
      .execute('contract_updateContract_deleteNormDetails');
  } catch (error) {
    throw error;
  }
}

async function viewMyContract(ss) {
  try {
    let result = await pool.request()
      .input('Token', sql.NVarChar, ss)
      .execute('contract_getContract_getContractByToken');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}

// lấy danh sách xe theo mã hợp đồng
async function viewMyCar(MaHopDong) {
  try {
    let result = await pool.request()
      .input('MaHopDong', sql.Int, MaHopDong)
      .execute('contract_viewMyCar_viewMyCar');
    return result.recordset;
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
async function viewMyRegistry(MaXe,Lan) {
  try {
    let result = await pool.request()
      .input('MaXe', sql.Int, MaXe)
      .input('Lan', sql.Int, Lan)
      .execute('contract_viewMyRegistry_viewMyRegistry');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
async function viewMyInsurance(MaXe,Lan) {
  try {
    let result = await pool.request()
      .input('MaXe', sql.Int, MaXe)
      .input('Lan', sql.Int, Lan)
      .execute('contract_viewMyInsurance_viewMyInsurance');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
async function viewMyEmblem(MaXe,Lan) {
  try {
    let result = await pool.request()
      .input('MaXe', sql.Int, MaXe)
      .input('Lan', sql.Int, Lan)
      .execute('contract_viewMyEmblem_viewMyEmblem');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
async function viewMyLocate(MaXe,Lan) {
  try {
    let result = await pool.request()
      .input('MaXe', sql.Int, MaXe)
      .input('Lan', sql.Int, Lan)
      .execute('contract_viewMyLocate_viewMyLocate');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
async function viewMyMaintenance(MaXe,Lan) {
  try {
    let result = await pool.request()
      .input('MaXe', sql.Int, MaXe)
      .input('Lan', sql.Int, Lan)
      .execute('contract_viewMyMaintenance_viewMyMaintenance');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
async function viewMyUsageHistory(MaXe,Lan) {
  try {
    let result = await pool.request()
      .input('MaXe', sql.Int, MaXe)
      .input('Lan', sql.Int, Lan)
      .execute('contract_viewMyUsageHistory_viewMyUsageHistory');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
module.exports = {
  checkSessionAndRole: checkSessionAndRole,
  getContract: getContract,
  getListNormDetailsByID: getListNormDetailsByID,
  deleteContract: deleteContract,
  insertContract: insertContract,
  updateContract: updateContract,
  viewMyContract: viewMyContract,
  viewMyCar: viewMyCar,
  getServiceByIDCar:getServiceByIDCar,
  getDetailContractByIDCar:getDetailContractByIDCar,
  viewMyRegistry:viewMyRegistry,
  viewMyInsurance:viewMyInsurance,
  viewMyEmblem:viewMyEmblem,
  viewMyLocate:viewMyLocate,
  viewMyMaintenance:viewMyMaintenance,
  viewMyUsageHistory:viewMyUsageHistory
};
