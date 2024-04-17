const db = require('../dbconfig');
const pool = db.getPool();
const sql = require('mssql');
const { format } = require('date-fns'); //ép định dạng cho ngày tháng năm
const bcrypt = require('bcrypt'); // dùng để mã hoá mật khẩu và tạo mã phiên đăng nhập
const nodemailer = require('nodemailer');//dùng để gửi email

//xử lý thêm thành viên
async function insertMember(data) {
  try {
    // kiểm tra email đã được  đăng ký chưa
    const resultCheckEmail = await pool.request()
      .input("Email", sql.NVarChar, data.Email)
      .execute("loginAndPermission_register_checkEmail");
    const CheckEmail = resultCheckEmail.recordset[0][''];
    if (CheckEmail) {
      return {
        success: false,
        message: 'Email đã được sử dụng'
      };
    } else {
      var hashedPassword
      var IDVaiTro = data.MaVaiTro
      hashedPassword = (typeof data.MatKhau === 'undefined'  || data.MatKhau ===null) ? null : await bcrypt.hash(data.MatKhau, 10);
      const resultInsertMember = await pool.request()
        .input('TenThanhVien', sql.NVarChar, data.TenThanhVien)
        .input('DiaChi', sql.NVarChar, data.DiaChi)
        .input('Email', sql.NVarChar, data.Email)
        .input('SoDienThoai', sql.VarChar, data.SoDienThoai)
        .input('MatKhau', sql.NVarChar, hashedPassword)
        .input('HinhAnh', sql.NVarChar, data.HinhAnh)
        .execute('member_insertMember_insertMember');

      const MaThanhVien = resultInsertMember.recordset[0][''];
      if (IDVaiTro != null) {
        IDVaiTro = IDVaiTro.split(',').map(item => {
          return +item;
        });
        IDVaiTro.map(async (item) => {
          await insertRolerMember(MaThanhVien, item)
        })
        return { success: true, message: "Thêm Dữ Liệu Thành Công!" };
      } else return { success: true, message: "Thêm Dữ Liệu Thành Công!" };
    }
  } catch (error) {
    throw error;
  }
}
// async function insertRolerMember(MaThanhVien, IDVaiTro) {
//   console.log('vào đây');
//   // for(let id of IDVaiTro) {
//   //   await pool.request()
//   //     .input('MaThanhVien', sql.Int, MaThanhVien)  
//   //     .input('MaVaiTro', sql.Int, id)
//   //     .execute('member_insertMember_insertRolerMember');
//   // }

// }

//hàm đăng nhập
async function login(data) {
  try {
    console.log(data.Email);
    let res = await pool.request()
      .input('Email', sql.VarChar, data.Email)
      .query('EXEC loginAndPermission_login_getListUsers @Email');
    if (res !== undefined && res.recordset.length > 0) {
      let matchedUser;
      for (const user of res.recordset) {
        const isPasswordMatch = await bcrypt.compare(data.MatKhau, user.MatKhau);
        if (isPasswordMatch) {
          matchedUser = user;
          break;
        }
      }
      if (matchedUser) {
        console.log("Tài khoản đã đăng nhập: ", matchedUser);
        const MaThanhVien = matchedUser.MaThanhVien; // Lấy ID từ người dùng khớp
        // Đăng nhập thành công
        const currentTime = Date.now().toString();
        const secret = "QLXe"; // Thay đổi chuỗi bí mật thành giá trị thực tế
        const MaDangNhap = bcrypt.hashSync(currentTime + secret, 10);
        //thêm 3 ngày thời hạn
        const currentTime2 = Date.now();

        const threeDaysLater = new Date(currentTime2 + (3 * 24 * 60 * 60 * 1000));
        const result = await pool.request()
          .input('MaDangNhap', sql.NVarChar, MaDangNhap)
          .input('HanDangNhap', sql.DateTime, threeDaysLater)
          .input('MaThanhVien', sql.Int, MaThanhVien)
          .query('EXEC loginAndPermission_login_updateUserLogin @MaDangNhap, @HanDangNhap, @MaThanhVien');
        if (result.rowsAffected[0] === 1)
          return {
            success: true,
            message: 'Đăng nhập thành công!',
            cookieValue: MaDangNhap
          }
        else {
          return {
            success: false,
            message: "Có lỗi xảy ra trong quá trình đăng nhập.",
          };
        }
      } else {
        // Mật khẩu không khớp
        return {
          success: false,
          message: "Email hoặc mật khẩu không chính xác!",
        };
      }
    } else {
      // Người dùng không tồn tại
      return {
        success: false,
        message: "Email hoặc mật khẩu không chính xác!",
      };
    }
  } catch (error) {
    throw error;
  }
}
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
//hàm kiểm tra phiên đăng nhập
async function session(MaDangNhap) {
  try {//kiểm tra thông tin đăng nhập từ mã đăng nhập
    let result = await pool
      .request()
      .input("MaDangNhap", sql.NVarChar, MaDangNhap.ss)
      .query('EXEC loginAndPermission_checkSessionAndRole_getInfoByMaDangNhap @MaDangNhap');
    if (result.recordset.length === 0) {
      return { success: false, message: "Bạn hãy đăng nhập lại!" };
    } else {//nếu mã đăng nhập hợp lệ thì kiểm tra hạn đăng nhập
      const timeSession = result.recordset[0].HanDangNhap;
      const currentTime = new Date();
      if (currentTime > timeSession) {
        return { success: false, message: "Đăng Nhập Đã Hết Hạn!" };
      } else {//thực hiện trả menu cho front-end
        let resultNhomQuyen = await pool
          .request()
          .input('MaThanhVien', sql.Int, result.recordset[0].MaThanhVien)
          .query('EXEC loginAndPermission_checkSessionAndRole_getPermissionByMaThanhVien @MaThanhVien');
        let menu = [];
        const permissions = resultNhomQuyen.recordset.map((row) => row.NhomQuyen);;
        for (const p of permissions) {
          if (menu.includes(p)) {
            //nếu như tên nhóm quyền đã nằm trong mảng thì không làm gì
          } else {
            menu.push(p);//nếu chưa có thì thêm vào mảng
          }
        } return { success: true, ThanhVien: result.recordset[0], menu: menu };
      }
    }
  } catch (error) {
    throw error;
  }
}
//xử lý đăng xuất
async function logout(MaDangNhap) {
  try {
    const result = await pool.request()
      .input('MaDangNhap', sql.NVarChar, MaDangNhap)
      .query('EXEC loginAndPermission_logout_logout @MaDangNhap');
    if (result.rowsAffected[0] === 1) {
      return {
        success: true,
        message: 'Đăng Xuất Thành Công'
      };
    } else {
      return {
        success: false,
        message: 'Đăng Xuất Không Thành Công'
      };
    }
  } catch (error) {
    throw error;
  }
}
// Hàm đăng ký
async function register(data) {
  try {
    // kiểm tra email đã được  đăng ký chưa
    const resultCheckEmail = await pool.request()
      .input("Email", sql.NVarChar, data.Email)
      .execute("loginAndPermission_register_checkEmail");
    const CheckEmail = resultCheckEmail.recordset[0][''];
    if (CheckEmail) {
      return {
        success: false,
        message: 'Email đã được sử dụng'
      };
    }
    // cấu hình email
    let transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'dangtuanthanh265@gmail.com',
        pass: 'jjgkyyjscrysbxsy' // Sử dụng biến môi trường EMAIL_PASSWORD
      }
    });
    const randomCode = generateRandomCode()
    console.log('randomCode',randomCode);
    let mailOptions = {
      from: 'dangtuanthanh265@gmail.com',
      to: `${data.Email}`,
      subject: 'Mã xác thực ứng dụng quản lý xe',
      text: `Chào bạn. Đây là mã xác thực kích hoạt tài khoản của bạn: ${randomCode}`
    };
    await transporter.sendMail(mailOptions, async function (error, info) {
      if (error) {
        throw error;
      } else {
        //sau khi gửi email, lưu mã vào csdl
        await pool.request()
          .input("Email", sql.NVarChar, data.Email)
          .input("MaXacThuc", sql.Int, randomCode)
          .input("TenThanhVien", sql.NVarChar, data.TenThanhVien)
          .input("MatKhau", sql.NVarChar, data.MatKhau)
          .execute("loginAndPermission_register_saveEmailAndCode");

      }
    });
    return {
      success: true
    };
    // const hashedPassword = await bcrypt.hash(data.Pass, 10);
    // let res = await pool
    //   .request()
    //   .input("HoTen", sql.NVarChar, data.HoTen)
    //   .input("UserName", sql.VarChar, data.UserName)
    //   .input("Pass", sql.NVarChar, hashedPassword) // Truyền mật khẩu đã được mã hóa
    //   .execute("loginAndPermission_register_saveEmailAndCode");
    // return res.recordsets;
  } catch (error) {
    console.log("Lỗi khi đăng ký: " + error);
    throw error;

  }
}
// tạo ngẫu nhiên chữ số:
function generateRandomCode() {
  let code = '';
  const possible = '0123456789';
  for (let i = 0; i < 4; i++) {
    code += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return code;
}
async function registerCode(Code) {
  try {
    const result = await pool.request()
      .input('Code', sql.Int, Code)
      .query('EXEC loginAndPermission_register_verificationCode @Code');
    if (result.recordset.length === 0) {
      return {
        success: false,
        message: 'Mã Xác Thực Không Chính Xác'
      };
    } else {
      const TenThanhVien = result.recordset[0]['TenThanhVien']
      console.log("result.recordset[0]['TenThanhVien']", result.recordset[0]['TenThanhVien']);
      const Email = result.recordset[0]['Email']
      const MatKhau = await bcrypt.hash(result.recordset[0]['MatKhau'], 10)
      const resultInsertMember = await pool.request()
        .input('TenThanhVien', sql.NVarChar, TenThanhVien)
        .input('DiaChi', sql.NVarChar, null)
        .input('Email', sql.NVarChar, Email)
        .input('SoDienThoai', sql.VarChar, null)
        .input('MatKhau', sql.NVarChar, MatKhau)
        .input('HinhAnh', sql.NVarChar, null)
        .execute('member_insertMember_insertMember');
        const MaThanhVien = resultInsertMember.recordset[0][''];
        await insertRolerMember(MaThanhVien, 0)
      return {
        success: true
      };
    }
  } catch (error) {
    throw error;
  }
}

//xử lý tải dữ liệu tài khoản
async function getMember() {
  try {
    let result = await pool.request().query('EXEC member_getMember_getMember');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//xử lý lấy danh sách vai trò theo id
async function getListRoleByIDAccount(ID) {
  try {
    let result = await pool.request()
      .input('ID', sql.Int, ID)
      .execute('member_getMember_getListRoleByID');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
// Hàm thay đổi thông tin người dùng
async function changeInfo(ss, data) {
  try {
    const MaDangNhap = { 'ss': ss }
    const resultSession = await session(MaDangNhap)
    console.log('data.HinhAnh',data.HinhAnh);
    console.log('typeof data.HinhAnh',typeof data.HinhAnh);
    if (resultSession.success) {
      await pool.request()
        .input('MaThanhVien', sql.Int, resultSession.ThanhVien.MaThanhVien)
        .input('TenThanhVien', sql.NVarChar, data.TenThanhVien)
        .input('SoDienThoai', sql.VarChar,  data.SoDienThoai ==='null'? null : data.SoDienThoai)
        .input('DiaChi', sql.NVarChar, data.DiaChi ==='null'? null : data.DiaChi)
        .input('HinhAnh', sql.NVarChar, data.HinhAnh ==='undefined'? null :data.HinhAnh)
        .execute('loginAndPermission_changeInfo');
      return { success: true, message: 'Sửa thông tin thành công' }
    } else return { success: false }
  } catch (error) {
    console.log("Lỗi sửa thông tin: " + error);
    throw error;

  }
}
//hàm đổi mật khẩu
async function changePassword(ss, MatKhauCu, MatKhauMoi) {
  try {//kiểm tra thông tin đăng nhập từ mã đăng nhập
    let result = await pool
      .request()
      .input("MaDangNhap", sql.NVarChar, ss)
      .query('EXEC loginAndPermission_checkSessionAndRole_getInfoByMaDangNhap @MaDangNhap');

    if (result.recordset.length === 0) {
      return { success: false, message: "Bạn hãy đăng nhập lại!" };
    } else {//nếu mã đăng nhập hợp lệ thì kiểm tra hạn đăng nhập
      const timeSession = result.recordset[0].HanDangNhap;
      const currentTime = new Date();
      if (currentTime > timeSession) {
        return { success: false, message: "Đăng Nhập Đã Hết Hạn!" };
      } else {
        // đã xác thực tài khoản
        // kiểm tra mật khẩu cũ:
        const isPasswordMatch = await bcrypt.compare(MatKhauCu, result.recordset[0].MatKhau);
        if (isPasswordMatch) {
          // mật khẩu cũ khớp
          // mã hoá mật khẩu mới 
          const BamMatKhauMoi = await bcrypt.hash(MatKhauMoi, 10)
          console.log('result.recordset[0].MaThanhVien', result.recordset[0].MaThanhVien);
          console.log('result.recordset[0]', result.recordset[0]);
          //cập nhật mật khẩu mới
          await pool.request()
            .input("MaThanhVien", sql.Int, result.recordset[0].MaThanhVien)
            .input("MaDangNhap", sql.NVarChar, ss)
            .input("MatKhauMoi", sql.NVarChar, BamMatKhauMoi)
            .execute('loginAndPermission_changePassword');
          return { success: true, message: "Đổi mật khẩu thành công!" };
        } else
          return { success: false, message: "Mật Khẩu Cũ Không Chính Xác" };
      }
    }
  } catch (error) {
    throw error;
  }
}
//xử lý tải danh sách vai trò
async function getRole() {
  try {
    let result = await pool.request().query('EXEC member_getRole_getRole');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//xử lý sửa thành viên
async function updateMember(data) {
  try {
    var hashedPassword = data.MatKhau ? await bcrypt.hash(data.MatKhau, 10) : null
    await pool.request()
      .input('MaThanhVien', sql.Int, data.MaThanhVien)
      .input('TenThanhVien', sql.NVarChar, data.TenThanhVien)
      .input('DiaChi', sql.NVarChar, data.DiaChi)
      .input('Email', sql.NVarChar, data.Email)
      .input('SoDienThoai', sql.VarChar, data.SoDienThoai)
      .input('MatKhau', sql.NVarChar, hashedPassword)
      .input('HinhAnh', sql.NVarChar, data.HinhAnh)
      .execute('member_updateMember_updateMember');
    if (data.MaVaiTro) {
      console.log('data.MaVaiTro', data.MaVaiTro);
      const MaVaiTro = data.MaVaiTro.split(',')
        .map(item => {
          return parseInt(item)
        });
      console.log('MaVaiTro', MaVaiTro);
      await Promise.all(
        MaVaiTro.map(async (item) => {
          // Gọi thủ tục lấy chi tiết hoá đơn cũ có IDHoaDon, IDSanPham
          const oldDetail = await getRolerMemberID(data.MaThanhVien, item)
          if (oldDetail.length < 1)
            //không có thì thêm
            await insertRolerMember(data.MaThanhVien, item)
        })
      );

      // Kiểm tra danh sách người dùng truyền vào
      const newList = await getListRoleByIDAccount(data.MaThanhVien)
      // Lọc các phần tử không có trong data.MaVaiTro
      const deleteList = newList.filter(item => {
        return !data.MaVaiTro.includes(item.MaVaiTro);
      })
      // Xóa các item trong deleteList
      for (const item of deleteList) {
        await deleteRolerMember(data.MaThanhVien, item.MaVaiTro)
      }
    } else {
      await pool.request()
        .input('MaThanhVien', sql.Int, data.MaThanhVien)
        .execute('member_updateMember_deleteAllRoler');
    }
    return { success: true, message: "Sửa Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}
// lấy danh sách cũ
async function getRolerMemberID(MaThanhVien, MaVaiTro) {
  try {
    let result = await pool.request()
      .input('MaThanhVien', sql.Int, MaThanhVien)
      .input('MaVaiTro', sql.Int, MaVaiTro)

      .execute('member_updateMember_getRolerMemberID');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
async function insertRolerMember(MaThanhVien, MaVaiTro) {
  await pool.request()
    .input('MaThanhVien', sql.Int, MaThanhVien)
    .input('MaVaiTro', sql.Int, MaVaiTro)
    .execute('member_updateMember_insertRolerMember');

}
//hàm xoá bảng vai trò thành viên
async function deleteRolerMember(MaThanhVien, MaVaiTro) {
  try {
    await pool.request()
      .input('MaThanhVien', sql.Int, MaThanhVien)
      .input('MaVaiTro', sql.Int, MaVaiTro)
      .execute('member_updateMember_deleteRolerMember');
  } catch (error) {
    throw error;
  }
}


//Hàm xoá thành viên
async function deleteMember(ID) {
  try {
    const result = await pool.request()
      .input('MaThanhVien', sql.Int, ID)
      .execute('member_deleteMember_deleteMember');
    return { ID, success: true, message: "Xoá Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}
//Hàm khôi phục dữ liệu đã xoá
async function undoDeleteMember(ID) {
  try {
    let res = await pool.request()
      .input('MaThanhVien', sql.Int, ID)
      .execute('member_deleteMember_undoDeleteMember');
  } catch (error) {
    throw error;
  }
}
//xử lý tải danh sách quyền
async function getPermission() {
  try {
    let result = await pool.request().execute('member_getPermission_getPermission');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//xử lý lấy quyền của vai trò theo id vai trò
async function getListPermissionByIDRole(ID) {
  try {
    let result = await pool.request()
      .input('ID', sql.Int, ID)
      .execute('member_getRole_getListPermissionByIDRole');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
//xử lý thêm dữ liệu vai trò
async function insertRole(data) {
  try {
    const result = await pool.request()
      .input('TenVaiTro', sql.NVarChar, data.TenVaiTro)
      .input('IDQuyen', sql.NVarChar, data.MaQuyen)
      .execute('member_insertRole_insertRole');
    return { success: true, message: "Thêm Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}

//xử lý sửa vai trò truy cập
async function updateRole(data) {
  try {
    const result = await pool.request()
      .input('MaVaiTro', sql.Int, data.MaVaiTro)
      .input('TenVaiTro', sql.NVarChar, data.TenVaiTro)
      .execute('member_updateRole_updateRole');
    if (data.MaQuyen) {
      const MaQuyen = data.MaQuyen.split(',')
        .map(item => {
          return parseInt(item)
        });
      await Promise.all(
        MaQuyen.map(async (item) => {
          // Gọi thủ tục lấy chi tiết hoá đơn cũ có IDHoaDon, IDSanPham
          const oldDetail = await getRolerPermissionID(data.MaVaiTro, item)
          if (oldDetail.length < 1)
            //không có thì thêm
            await insertRolerPermission(data.MaVaiTro, item)
        })
      );

      // Kiểm tra danh sách người dùng truyền vào
      const newList = await getListPermissionByIDRole(data.MaVaiTro)
      // Lọc các phần tử không có trong data.MaQuyen
      const deleteList = newList.filter(item => {
        return !data.MaQuyen.includes(item.MaQuyen);
      })
      // Xóa các item trong deleteList
      for (const item of deleteList) {
        await deleteRolerPermission(data.MaVaiTro, item.MaQuyen)
      }
    } else return { success: true, message: "Sửa Dữ Liệu Thành Công!" };
    return { success: true, message: "Sửa Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}
// lấy danh sách quyền, vai trò cũ
async function getRolerPermissionID(MaVaiTro, MaQuyen) {
  try {
    let result = await pool.request()
      .input('MaVaiTro', sql.Int, MaVaiTro)
      .input('MaQuyen', sql.Int, MaQuyen)
      .execute('member_updateRoler_getRolerPermissionID');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}
async function insertRolerPermission(MaVaiTro, MaQuyen) {
  await pool.request()
    .input('MaVaiTro', sql.Int, MaVaiTro)
    .input('MaQuyen', sql.Int, MaQuyen)
    .execute('member_updateRoler_insertRolerPermission');

}
//hàm xoá bảng quyền vai trò
async function deleteRolerPermission(MaVaiTro, MaQuyen) {
  try {
    await pool.request()
      .input('MaVaiTro', sql.Int, MaVaiTro)
      .input('MaQuyen', sql.Int, MaQuyen)
      .execute('member_updateRoler_deleteRolerPermission');
  } catch (error) {
    throw error;
  }
}

//Hàm xoá vai trò truy cập
async function deleteRole(ID) {
  try {
    await pool.request()
      .input('MaVaiTro', sql.Int, ID)
      .execute('member_deleteRole_deleteRole');
    return { ID, success: true, message: "Xoá Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}








//Xử lý tìm kiếm tài khoản: 
async function searchAccount(search, searchBy) {
  try {
    let result = await pool.request()
      .input('search', sql.NVarChar, search)
      .input('searchBy', sql.NVarChar, searchBy)
      .query('EXEC employee_searchAccount_searchAccount @search, @searchBy');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}























//xử lý tải danh sách vị trí công việc
async function getJobPosition() {
  try {
    let result = await pool.request().query('EXEC employee_getJobPosition_getJobPosition');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}

//Hàm xoá vai trò truy cập
async function deleteJobPosition(ID) {
  try {
    console.log('ID', ID);
    const result = await pool.request()
      .input('IDViTriCongViec', sql.Int, ID)
      .execute('employee_deleteJobPosition_deleteJobPosition');
    return { ID, success: true, message: "Xoá Dữ Liệu Thành Công!" };
  } catch (error) {
    throw error;
  }
}

//xử lý thêm vị trí công việc
async function insertJobPosition(data) {
  try {
    let MoTa = null;
    if (typeof data.MoTa === 'undefined')
      MoTa = null;
    else MoTa = data.MoTa;
    await pool.request()
      .input('TenViTriCongViec', sql.NVarChar, data.TenViTriCongViec)
      .input('MoTa', sql.NVarChar, MoTa)
      .execute('employee_insertJobPosition_insertJobPosition');
    return { success: true };
  } catch (error) {
    throw error;
  }
}

//xử lý cập nhật vị trí công việc
async function updateJobPosition(data) {
  try {
    let MoTa = null;
    if (typeof data.MoTa === 'undefined')
      MoTa = null;
    else MoTa = data.MoTa;
    await pool.request()
      .input('IDViTriCongViec', sql.Int, data.IDViTriCongViec)
      .input('TenViTriCongViec', sql.NVarChar, data.TenViTriCongViec)
      .input('MoTa', sql.NVarChar, MoTa)
      .execute('employee_updateJobPosition_updateJobPosition');
    return { success: true };
  } catch (error) {
    throw error;
  }
}




//Xử lý sửa dữ liệu hàng loạt
async function getDataSelected(recordIds) {
  try {
    let pool = await sql.connect(config);
    let res = await pool.request().query(`SELECT * FROM HoaDon WHERE SoHD IN (${recordIds})`);

    if (res.recordset.length > 0) {
      const result = res.recordset.map(row => {
        const ngayHoaDon = format(new Date(row.NgayHD), 'dd-MM-yyyy');
        const ngayGiao = format(new Date(row.NgayGiao), 'dd-MM-yyyy');
        return {
          SoHD: row.SoHD,
          NgayHD: ngayHoaDon,
          NgayGiao: ngayGiao,
          MaKH: row.MaKH,
          MaNV: row.MaNV
        };
      });
      return result;
    }
  } catch (error) {
    console.log(" mathus-error :" + error);
    throw error;
  }
}

async function getDetailContractByIDThanhVien(MaThanhVien) {
  try {
    let result = await pool.request()
      .input('MaThanhVien', sql.Int, MaThanhVien)
      .execute('member_getMember_getDetailContractByIDThanhVien');
    return result.recordset;
  } catch (error) {
    throw error;
  }
}


module.exports = {
  checkSessionAndRole: checkSessionAndRole,
  login: login,
  session: session,
  logout: logout,
  register: register,
  registerCode: registerCode,
  getMember: getMember,
  changeInfo: changeInfo,
  updateMember: updateMember,
  deleteMember: deleteMember,
  undoDeleteMember: undoDeleteMember,



  searchAccount: searchAccount,
  insertMember: insertMember,
  getRole: getRole,
  getJobPosition: getJobPosition,

  getListRoleByIDAccount: getListRoleByIDAccount,
  getListPermissionByIDRole: getListPermissionByIDRole,
  insertRole: insertRole,
  getPermission: getPermission,
  updateRole: updateRole,
  deleteRole: deleteRole,
  deleteJobPosition: deleteJobPosition,
  insertJobPosition: insertJobPosition,
  updateJobPosition: updateJobPosition,
  changePassword: changePassword,
  getDataSelected: getDataSelected,

  getDetailContractByIDThanhVien: getDetailContractByIDThanhVien
};
